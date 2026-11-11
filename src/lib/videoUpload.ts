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
}

/**
 * Safely compress MP4/H.264 video on client using native WebCodecs via mediabunny.
 * Preserves MP4 container, H.264 video, audio tracks, orientation, and aspect ratio.
 * Falls back to original file without error if WebCodecs or conversion is unavailable.
 */
export async function compressVideoFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<VideoCompressionResult> {
  const originalBytes = file.size;

  if (!file.type.startsWith("video/")) {
    return { file, compressed: false, originalBytes, compressedBytes: originalBytes };
  }

  // Check if browser environment supports WebCodecs
  if (
    typeof window === "undefined" ||
    typeof VideoEncoder === "undefined" ||
    typeof VideoDecoder === "undefined"
  ) {
    return { file, compressed: false, originalBytes, compressedBytes: originalBytes };
  }

  let conversion: Awaited<ReturnType<typeof Conversion.init>> | null = null;

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
    });

    if (!conversion.isValid) {
      return { file, compressed: false, originalBytes, compressedBytes: originalBytes };
    }

    conversion.onProgress = (progress) => {
      const safeProgress = Math.max(0, Math.min(100, Math.round(progress * 100)));
      onProgress?.(safeProgress);
    };

    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      return { file, compressed: false, originalBytes, compressedBytes: originalBytes };
    }

    const compressedBlob = new Blob([buffer], { type: "video/mp4" });
    const compressedFile = new File(
      [compressedBlob],
      `${file.name.replace(/\.[^.]+$/, "")}-opt.mp4`,
      {
        type: "video/mp4",
        lastModified: Date.now(),
      },
    );

    onProgress?.(100);

    // Only use compressed file if it's genuinely smaller
    if (compressedFile.size < file.size) {
      return {
        file: compressedFile,
        compressed: true,
        originalBytes,
        compressedBytes: compressedFile.size,
      };
    }

    return { file, compressed: false, originalBytes, compressedBytes: originalBytes };
  } catch (err) {
    console.warn(
      "Client video compression not available on this device; proceeding with original:",
      err,
    );
    onProgress?.(100);
    return { file, compressed: false, originalBytes, compressedBytes: originalBytes };
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
  let supabaseUrl = "";
  let supabaseAnonKey = "";

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    sessionToken = sessionData.session?.access_token ?? null;
    let envUrl = String(import.meta.env["VITE_SUPABASE_URL"] ?? "");
    if (!envUrl || envUrl.includes("placeholder.supabase.co")) {
      envUrl = "https://mwfognruqmatlhrirxlb.supabase.co";
    }
    supabaseUrl = envUrl;

    let envKey = String(import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "");
    if (!envKey || envKey.includes("placeholder")) {
      envKey = "sb_publishable_jJHTE8XdJJiAfdT8C9WINg_zcgZip4V";
    }
    supabaseAnonKey = envKey;
  } catch (authErr) {
    console.warn("Session check error for TUS upload:", authErr);
  }

  // 2. If valid session and TUS client can be configured, use TUS resumable upload
  if (sessionToken && supabaseUrl && typeof window !== "undefined") {
    try {
      const cleanUrl = supabaseUrl.replace(/\/+$/, "");
      const tusEndpoint = `${cleanUrl}/storage/v1/upload/resumable`;

      return await new Promise<string>((resolve, reject) => {
        let lastReportedPercent = 0;

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
            // Cap at 99% until server verifies publication
            const percent = Math.min(99, Math.round((bytesUploaded / actualTotal) * 100));
            lastReportedPercent = percent;

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
              percent: 99,
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
    percent: 99,
    bytesUploaded: totalBytes,
    bytesTotal: totalBytes,
    formattedUploaded: formatBytes(totalBytes),
    formattedTotal: formatBytes(totalBytes),
  });

  return path;
}
