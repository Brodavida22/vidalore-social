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
    return {
      file,
      compressed: false,
      originalBytes,
      compressedBytes: originalBytes,
      convertedToH264: false,
    };
  }

  // 1. Probe input to determine codec and tracks
  let requiresConversion = false;
  let detectedCodec = "unknown";
  let hasAudioTrack = false;
  let isAlreadyH264 = false;

  try {
    const probeInput = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(file),
    });

    const vTrack = await probeInput.getPrimaryVideoTrack();
    const aTracks = await probeInput.getAudioTracks().catch(() => []);
    hasAudioTrack = aTracks.length > 0;

    if (vTrack) {
      const codec = (await vTrack.getCodec()) || "";
      const internalId = (await vTrack.getInternalCodecId()) || "";
      const internalStr = typeof internalId === "string" ? internalId.toLowerCase() : "";
      detectedCodec = codec || internalStr || "video";

      // Check if already standard H.264/AVC
      isAlreadyH264 = codec === "avc" || internalStr.startsWith("avc1");

      const isHevc =
        codec === "hevc" || internalStr.startsWith("hev1") || internalStr.startsWith("hvc1");
      const isMov = file.type.includes("quicktime") || file.name.toLowerCase().endsWith(".mov");

      // HEVC, QuickTime, or non-AVC formats REQUIRE conversion to guarantee browser playback
      if (isHevc || isMov || !isAlreadyH264) {
        requiresConversion = true;
      }
    } else {
      // No video track detected or unusual container
      requiresConversion = true;
    }
  } catch (probeErr) {
    console.warn("Could not probe video format with Mediabunny; checking filename/mime:", probeErr);
    const lowerName = file.name.toLowerCase();
    if (
      file.type.includes("quicktime") ||
      lowerName.endsWith(".mov") ||
      lowerName.endsWith(".m4v")
    ) {
      requiresConversion = true;
    }
  }

  // 2. Verify WebCodecs support
  const webCodecsAvailable = isWebCodecsSupported();

  if (!webCodecsAvailable) {
    if (requiresConversion) {
      throw new Error(
        `This video is encoded in ${detectedCodec.toUpperCase()} / QuickTime format, which requires conversion to H.264 MP4 to play in mobile browsers. Your current device or browser does not support in-browser video conversion. Please convert the video to standard H.264 MP4 before uploading.`,
      );
    }

    // Video is already verified H.264/AVC, so it can be uploaded as-is if encoder is unavailable
    return {
      file,
      compressed: false,
      originalBytes,
      compressedBytes: originalBytes,
      detectedCodec: "avc",
      convertedToH264: false,
    };
  }

  // 3. Perform conversion to standard H.264/AVC 720p 30fps with AAC audio
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

    const conversion = await Conversion.init({
      input,
      output,
      tracks: "all",
      video: {
        codec: "avc",
        height: 720,
        frameRate: 30,
        quality: new Quality("medium"),
        hardwareAcceleration: "no-preference",
      },
      ...(hasAudioTrack ? { audio: { codec: "aac" as const } } : {}),
    });

    if (!conversion.isValid) {
      if (requiresConversion) {
        throw new Error(
          `This device cannot convert the selected ${detectedCodec.toUpperCase()} video to H.264 MP4. Please convert the video to standard H.264 MP4 before publishing.`,
        );
      }
      return {
        file,
        compressed: false,
        originalBytes,
        compressedBytes: originalBytes,
        detectedCodec: "avc",
        convertedToH264: false,
      };
    }

    conversion.onProgress = (progressFraction) => {
      const safeProgress = Math.max(0, Math.min(100, Math.round(progressFraction * 100)));
      onProgress?.(safeProgress);
    };

    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      if (requiresConversion) {
        throw new Error("Video conversion produced an empty file. Please choose another video.");
      }
      return {
        file,
        compressed: false,
        originalBytes,
        compressedBytes: originalBytes,
        detectedCodec: "avc",
        convertedToH264: false,
      };
    }

    const compressedBlob = new Blob([buffer], { type: "video/mp4" });
    const cleanName = file.name.replace(/\.[^.]+$/, "");
    const convertedFile = new File([compressedBlob], `${cleanName}.mp4`, {
      type: "video/mp4",
      lastModified: Date.now(),
    });

    onProgress?.(100);

    // If conversion was required (e.g. HEVC or MOV), ALWAYS use convertedFile
    // even if it is slightly larger, because unconverted HEVC/MOV fails in browsers!
    if (requiresConversion || convertedFile.size < file.size) {
      return {
        file: convertedFile,
        compressed: convertedFile.size < file.size,
        originalBytes,
        compressedBytes: convertedFile.size,
        detectedCodec: "avc",
        convertedToH264: true,
      };
    }

    // Video was already H.264 and original is smaller than 720p re-encode
    return {
      file,
      compressed: false,
      originalBytes,
      compressedBytes: originalBytes,
      detectedCodec: "avc",
      convertedToH264: false,
    };
  } catch (err) {
    if (requiresConversion) {
      // Re-throw user-facing error when conversion is mandatory for playback
      const message =
        err instanceof Error ? err.message : "Video conversion failed on this device.";
      throw new Error(
        `Could not convert ${detectedCodec.toUpperCase()} video: ${message}. An H.264 MP4 video is required.`,
      );
    }

    console.warn("Optional compression failed on already-compatible video; using original:", err);
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
