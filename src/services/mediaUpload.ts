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

export interface CompressionOptions {
  maxHeight?: number;
  maxFps?: number;
  quality?: "low" | "medium" | "high";
}

export interface VideoCompressionResult {
  file: File;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
}

export interface UploadProgressDetails {
  bytesUploaded: number;
  bytesTotal: number;
  percent: number;
  speedBytesPerSec?: number;
}

/**
 * Check if the current browser environment supports WebCodecs hardware/software encoding.
 */
export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined";
}

/**
 * Compresses video client-side using Mediabunny (WebCodecs) to MP4 / H.264.
 *
 * Defaults:
 * - Target container: MP4
 * - Codec: H.264 (AVC)
 * - Maximum height: 720p (preserves aspect ratio)
 * - Maximum frame rate: 30 FPS
 * - Quality: medium
 *
 * If device lacks WebCodecs or compression fails or produces a larger file,
 * returns the original file with `compressed: false`.
 */
export async function compressVideo(
  file: File,
  options: CompressionOptions = {},
  onProgress?: (percent: number) => void,
): Promise<VideoCompressionResult> {
  const originalSize = file.size;

  if (!file.type.startsWith("video/")) {
    return {
      file,
      compressed: false,
      originalSize,
      compressedSize: originalSize,
      savedPercent: 0,
    };
  }

  if (!isWebCodecsSupported()) {
    console.info("WebCodecs not supported on this browser; skipping compression.");
    return {
      file,
      compressed: false,
      originalSize,
      compressedSize: originalSize,
      savedPercent: 0,
    };
  }

  const maxHeight = options.maxHeight ?? 720;
  const maxFps = options.maxFps ?? 30;
  const quality = options.quality ?? "medium";

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

    const aTracks = await input.getAudioTracks().catch(() => []);
    const hasAudio = aTracks.length > 0;

    const conversion = await Conversion.init({
      input,
      output,
      tracks: "all",
      video: {
        codec: "avc",
        height: maxHeight,
        frameRate: maxFps,
        quality: new Quality(quality),
        hardwareAcceleration: "no-preference",
      },
      ...(hasAudio ? { audio: { codec: "aac" as const } } : {}),
    });

    if (!conversion.isValid) {
      console.warn("Conversion parameters not valid for this video/device.");
      return {
        file,
        compressed: false,
        originalSize,
        compressedSize: originalSize,
        savedPercent: 0,
      };
    }

    conversion.onProgress = (fraction) => {
      const p = Math.max(0, Math.min(100, Math.round(fraction * 100)));
      onProgress?.(p);
    };

    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      throw new Error("Compression yielded empty buffer");
    }

    const compressedBlob = new Blob([buffer], { type: "video/mp4" });
    const cleanName = file.name.replace(/\.[^.]+$/, "");
    const compressedFile = new File([compressedBlob], `${cleanName}-optimized.mp4`, {
      type: "video/mp4",
      lastModified: Date.now(),
    });

    onProgress?.(100);

    // Only keep compressed file if it's actually smaller
    if (compressedFile.size >= originalSize) {
      console.info("Compressed file was larger than original; retaining original.");
      return {
        file,
        compressed: false,
        originalSize,
        compressedSize: originalSize,
        savedPercent: 0,
      };
    }

    const savedPercent = Math.round((1 - compressedFile.size / originalSize) * 100);
    return {
      file: compressedFile,
      compressed: true,
      originalSize,
      compressedSize: compressedFile.size,
      savedPercent,
    };
  } catch (err) {
    console.warn("Video compression encountered an issue; falling back to original file:", err);
    onProgress?.(100);
    return {
      file,
      compressed: false,
      originalSize,
      compressedSize: originalSize,
      savedPercent: 0,
    };
  }
}

/**
 * Resumable TUS upload to Supabase Storage with chunking, retry handling and progress tracking.
 */
export async function uploadResumableTus(params: {
  bucket: string;
  path: string;
  file: File;
  onProgress?: (details: UploadProgressDetails) => void;
}): Promise<string> {
  const { bucket, path, file, onProgress } = params;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  return new Promise<string>((resolve, reject) => {
    let lastTime = Date.now();
    let lastLoaded = 0;

    const upload = new tus.Upload(file, {
      endpoint: `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/upload/resumable`,
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
        "x-upsert": "false",
      },
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024, // 6 MB chunks
      retryDelays: [0, 3000, 5000, 10000, 20000],
      removeFingerprintOnSuccess: true,
      onProgress(bytesUploaded, bytesTotal) {
        if (bytesTotal > 0) {
          const now = Date.now();
          const elapsed = (now - lastTime) / 1000;
          let speedBytesPerSec: number | undefined;
          if (elapsed > 0.5) {
            speedBytesPerSec = (bytesUploaded - lastLoaded) / elapsed;
            lastTime = now;
            lastLoaded = bytesUploaded;
          }

          const percent = Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100));
          onProgress?.({
            bytesUploaded,
            bytesTotal,
            percent,
            ...(speedBytesPerSec !== undefined ? { speedBytesPerSec } : {}),
          });
        }
      },
      onError(error) {
        console.error("TUS resumable upload error:", error);
        reject(
          new Error(
            `Upload error: ${
              error.message || "Please check your network connection and try again."
            }`,
          ),
        );
      },
      onSuccess() {
        onProgress?.({
          bytesUploaded: file.size,
          bytesTotal: file.size,
          percent: 100,
        });
        resolve(path);
      },
    });

    upload.start();
  });
}

/**
 * Uploads media intelligently:
 * - Uses resumable TUS upload for video files
 * - Uses standard Supabase upload for images
 */
export async function uploadMediaSmart(params: {
  bucket: string;
  path: string;
  file: File;
  onProgress?: (details: UploadProgressDetails) => void;
}): Promise<string> {
  const { bucket, path, file, onProgress } = params;

  if (file.type.startsWith("video/")) {
    return uploadResumableTus({ bucket, path, file, ...(onProgress ? { onProgress } : {}) });
  }

  // Standard upload for images
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  onProgress?.({
    bytesUploaded: file.size,
    bytesTotal: file.size,
    percent: 100,
  });

  return path;
}
