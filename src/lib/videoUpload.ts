import * as tus from "tus-js-client";
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
} from "mediabunny";
import { supabase } from "@/integrations/supabase/client";

export interface VideoUploadProgress {
  stage: "idle" | "preparing" | "compressing" | "uploading" | "publishing" | "success" | "error";
  percent: number; // 0 to 100
  bytesUploaded: number;
  bytesTotal: number;
  formattedUploaded: string; // e.g. "18.5 MB"
  formattedTotal: string; // e.g. "24.6 MB"
  errorMessage?: string;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(decimals)} MB`;
}

export interface VideoCompressionResult {
  file: File;
  compressed: boolean;
  originalBytes: number;
  compressedBytes: number;
  detectedCodec?: string;
  convertedToH264: boolean;
}

/**
 * Checks if the browser environment supports WebCodecs hardware/software encoding and decoding.
 */
export function isWebCodecsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof VideoEncoder !== "undefined" &&
    typeof VideoDecoder !== "undefined"
  );
}

/**
 * Ensures uploaded Reels and Stories videos are converted to standard MP4 with H.264/AVC
 * video encoding and AAC-compatible audio.
 *
 * Rules:
 * - Detects container and video track codec (e.g. HEVC/H.265, AVC/H.264, VP9, QuickTime/MOV).
 * - If video is encoded in HEVC/H.265, MOV or non-AVC, conversion to H.264 MP4 is REQUIRED for playback.
 * - Never silently upload an unsupported HEVC/MOV file if conversion is required.
 * - If conversion is unavailable or fails on this device, throws a clear user-facing error.
 * - Preserves audio tracks (transcoded to AAC), orientation and aspect ratio.
 * - Resulting file has type "video/mp4" and ".mp4" file extension.
 */

export async function compressVideoFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<VideoCompressionResult> {
  const originalBytes = file.size;

  if (!file.type.startsWith("video/")) {
    throw new Error("Please select a valid video file.");
  }

  let detectedCodec = "unknown";
  let hasAudioTrack = false;
  let isAlreadyH264 = false;
  let isAlreadyAac = false;
  let isMp4 = false;

  // 1. Inspect the original video.
  try {
    const probeInput = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(file),
    });

    const videoTrack = await probeInput.getPrimaryVideoTrack();

    if (!videoTrack) {
      throw new Error("No video track was found in this file.");
    }

    const audioTracks = await probeInput.getAudioTracks();

    hasAudioTrack = audioTracks.length > 0;

    const codec = await videoTrack.getCodec();
    const internalId = await videoTrack.getInternalCodecId();

    const internalCodec =
      typeof internalId === "string"
        ? internalId.toLowerCase()
        : "";

    detectedCodec = codec || internalCodec || "unknown";

    isAlreadyH264 =
      codec === "avc" || internalCodec.startsWith("avc1");

    isMp4 =
      file.type.toLowerCase().includes("mp4") ||
      file.name.toLowerCase().endsWith(".mp4");

    isAlreadyAac =
      !hasAudioTrack ||
      (await Promise.all(
        audioTracks.map(async (track) => {
          return (await track.getCodec()) === "aac";
        }),
      )).every(Boolean);

    // Only skip conversion when the file is already a compatible
    // MP4 containing decodable H.264 and AAC tracks.
    if (isAlreadyH264 && isAlreadyAac && isMp4) {
      const videoCanDecode = await videoTrack.canDecode();

      const audioCanDecode = await Promise.all(
        audioTracks.map((track) => track.canDecode()),
      );

      if (videoCanDecode && audioCanDecode.every(Boolean)) {
        onProgress?.(100);

        return {
          file,
          compressed: false,
          originalBytes,
          compressedBytes: originalBytes,
          detectedCodec: "avc",
          convertedToH264: false,
        };
      }
    }
  } catch (error) {
    console.warn("Original video inspection failed:", error);

    // Unknown or unreadable formats must not silently bypass conversion.
    throw new Error(
      "We could not inspect this video. Please try another video or convert it to H.264 MP4 before uploading.",
    );
  }

  // 2. Convert to MP4 using H.264 video and AAC audio.
  let conversion: Conversion | undefined;

  try {
    onProgress?.(0);

    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(file),
    });

    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget(),
    });

    conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        codec: "avc",
        height: 720,
        frameRate: 30,
        quality: new Quality("medium"),
        hardwareAcceleration: "no-preference",
      },
      ...(hasAudioTrack
        ? { audio: { codec: "aac" as const } }
        : {}),
    });

    // Check that the required tracks can actually be converted.
    const usableVideo = conversion.utilizedTracks.some(
      (track) => track.type === "video",
    );

    const usableAudio =
      !hasAudioTrack ||
      conversion.utilizedTracks.some(
        (track) => track.type === "audio",
      );

    if (!conversion.isValid || !usableVideo || !usableAudio) {
      const reasons = conversion.discardedTracks
        .map((item) => `${item.track.type}: ${item.reason}`)
        .join(", ");

      throw new Error(
        `This device cannot convert the video into the required format. ${reasons}`,
      );
    }

    conversion.onProgress = (progress) => {
      onProgress?.(
        Math.max(0, Math.min(99, Math.round(progress * 100))),
      );
    };

    await conversion.execute();

    const buffer = output.target.buffer;

    if (!buffer || buffer.byteLength === 0) {
      throw new Error("The converted video is empty.");
    }

    const convertedBlob = new Blob([buffer], {
      type: "video/mp4",
    });

    const cleanName = file.name.replace(/\.[^.]+$/, "");

    const convertedFile = new File(
      [convertedBlob],
      `${cleanName}.mp4`,
      {
        type: "video/mp4",
        lastModified: Date.now(),
      },
    );

    // 3. Verify the resulting MP4 before allowing it to upload.
    const verifyInput = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(convertedFile),
    });

    const verifiedVideo =
      await verifyInput.getPrimaryVideoTrack();

    if (!verifiedVideo) {
      throw new Error("The converted MP4 has no video track.");
    }

    const verifiedVideoCodec =
      await verifiedVideo.getCodec();

    if (verifiedVideoCodec !== "avc") {
      throw new Error(
        `Expected H.264 video, but received ${verifiedVideoCodec || "unknown"}.`,
      );
    }

    const verifiedAudio = await verifyInput.getAudioTracks();

    if (hasAudioTrack) {
      if (verifiedAudio.length === 0) {
        throw new Error(
          "The converted video lost its original audio track.",
        );
      }

      const audioCodec = await verifiedAudio[0].getCodec();

      if (audioCodec !== "aac") {
        throw new Error(
          `Expected AAC audio, but received ${audioCodec || "unknown"}.`,
        );
      }
    }

    onProgress?.(100);

    return {
      file: convertedFile,
      compressed: convertedFile.size < originalBytes,
      originalBytes,
      compressedBytes: convertedFile.size,
      detectedCodec: "avc",
      convertedToH264: true,
    };
  } catch (error) {
    console.error("Required video conversion failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown conversion error.";

    throw new Error(
      `Video conversion failed: ${message}. Please try another video or upload a standard H.264 MP4.`,
    );
  }
}

/**
 * Uploads a video to Supabase Storage using TUS resumable uploads where supported,
 * reporting real bytes uploaded, total bytes, and progress percentage.
 * Provides resilient fallback to standard storage upload if TUS is unavailable.
 */
export async function uploadVideoResumable(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (progressInfo: VideoUploadProgress) => void,
): Promise<string> {
  const totalBytes = file.size;

  onProgress?.({
    stage: "uploading",
    percent: 0,
    bytesUploaded: 0,
    bytesTotal: totalBytes,
    formattedUploaded: "0 MB",
    formattedTotal: formatBytes(totalBytes),
  });

  // 1. Verify session token for Supabase Storage TUS authentication
  let sessionToken: string | null = null;
  const supabaseUrl: string = import.meta.env["VITE_SUPABASE_URL"];
  const supabaseAnonKey: string = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    sessionToken = sessionData.session?.access_token ?? null;
  } catch (authErr) {
    console.warn("Session check error for TUS upload:", authErr);
  }

  // 2. If valid session and TUS client can be configured, use TUS resumable upload
  if (sessionToken && supabaseUrl && typeof window !== "undefined") {
    try {
      const cleanUrl = supabaseUrl.replace(/\/+$/, "");
      const tusEndpoint = `${cleanUrl}/storage/v1/upload/resumable`;

      return await new Promise<string>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: tusEndpoint,
          headers: {
            authorization: `Bearer ${sessionToken}`,
            apikey: supabaseAnonKey,
            "x-upsert": "false",
          },
          metadata: {
            bucketName: bucket,
            objectName: path,
            contentType: file.type || "video/mp4",
            cacheControl: "3600",
          },
          chunkSize: 6 * 1024 * 1024, // 6 MB standard Supabase S3 chunk size
          retryDelays: [0, 1000, 3000, 5000, 10000],
          removeFingerprintOnSuccess: true,

          onProgress(bytesUploaded, bytesTotal) {
            const actualTotal = bytesTotal > 0 ? bytesTotal : totalBytes;
            const percent = Math.min(99, Math.round((bytesUploaded / actualTotal) * 100));

            onProgress?.({
              stage: "uploading",
              percent,
              bytesUploaded,
              bytesTotal: actualTotal,
              formattedUploaded: formatBytes(bytesUploaded),
              formattedTotal: formatBytes(actualTotal),
            });
          },

          onError(error) {
            console.warn("TUS upload error, attempting storage fallback:", error);
            reject(error);
          },

          onSuccess() {
            onProgress?.({
              stage: "uploading",
              percent: 100,
              bytesUploaded: totalBytes,
              bytesTotal: totalBytes,
              formattedUploaded: formatBytes(totalBytes),
              formattedTotal: formatBytes(totalBytes),
            });
            resolve(path);
          },
        });

        upload.start();
      });
    } catch (tusErr) {
      console.warn("TUS upload failed, falling back to standard upload:", tusErr);
    }
  }

  // 3. Fallback to standard Supabase Storage upload
  onProgress?.({
    stage: "uploading",
    percent: 15,
    bytesUploaded: Math.round(totalBytes * 0.15),
    bytesTotal: totalBytes,
    formattedUploaded: formatBytes(Math.round(totalBytes * 0.15)),
    formattedTotal: formatBytes(totalBytes),
  });

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "video/mp4",
    upsert: false,
  });

  if (error) {
    throw new Error(`Video upload failed: ${error.message}`);
  }

  onProgress?.({
    stage: "uploading",
    percent: 100,
    bytesUploaded: totalBytes,
    bytesTotal: totalBytes,
    formattedUploaded: formatBytes(totalBytes),
    formattedTotal: formatBytes(totalBytes),
  });

  return path;
}
