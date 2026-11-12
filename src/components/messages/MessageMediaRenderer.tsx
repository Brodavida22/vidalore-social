import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Maximize2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type MessageMediaRendererProps = {
  messageType?: string | null;
  mediaUrl?: string | null;
  mediaName?: string | null;
  isMine?: boolean;
};

const BUCKET = "chat-media";
const WAVEFORM_BARS = [
  10, 16, 23, 14, 30, 19, 37, 25, 15, 32, 22, 42, 27, 17, 35, 24,
  44, 29, 18, 36, 25, 48, 31, 20, 39, 26, 45, 33, 17, 38, 24, 43,
  29, 15, 34, 22, 46, 30, 18, 40, 26, 49, 32, 19, 37, 25, 43, 28,
  16, 35, 23, 41, 27, 14, 33, 21, 39, 26, 45, 30, 18, 36, 24, 42,
];

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function extractStoragePath(value: string): string | null {
  if (!value || value.startsWith("blob:")) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");

  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const tail = url.pathname.slice(markerIndex + marker.length);
    const parts = tail.split("/");
    if (parts[0] === "sign" || parts[0] === "public" || parts[0] === "authenticated") {
      parts.shift();
    }
    const bucket = parts.shift();
    if (bucket !== BUCKET) return null;
    return parts.map((part) => decodeURIComponent(part)).join("/");
  } catch {
    return null;
  }
}

async function resolveMediaUrl(value: string): Promise<string> {
  if (/^https?:\/\//i.test(value) && !value.includes("/storage/v1/object/")) {
    return value;
  }
  const path = extractStoragePath(value);
  if (!path) {
    if (value.startsWith("blob:")) {
      throw new Error("This attachment is no longer available. Please ask the sender to upload it again.");
    }
    throw new Error("The attachment link is invalid.");
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Could not load this attachment.");
  return data.signedUrl;
}

export function MessageMediaRenderer({
  messageType,
  mediaUrl,
  mediaName,
  isMine = false,
}: MessageMediaRendererProps) {
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const kind = (messageType || "").toLowerCase();
  const isAudio = ["audio", "voice", "voice_note", "voicenote"].includes(kind);
  const isImage = kind === "image" || /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(mediaName || mediaUrl || "");
  const isVideo = kind === "video" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(mediaName || mediaUrl || "");
  const isPdf = kind === "file" && /\.pdf$/i.test(mediaName || mediaUrl || "");

  const loadMedia = useCallback(async () => {
    if (!mediaUrl) {
      setLoadError("Attachment unavailable.");
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const url = await resolveMediaUrl(mediaUrl);
      setResolvedUrl(url);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load attachment.");
    } finally {
      setLoading(false);
    }
  }, [mediaUrl]);

  useEffect(() => {
    setResolvedUrl("");
    setLoadError("");
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    setAudioError(false);
    void loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    const updateDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", () => setAudioError(true));
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [resolvedUrl]);

  const progress = useMemo(
    () => duration > 0 && Number.isFinite(duration) ? Math.min(1, Math.max(0, currentTime / duration)) : 0,
    [currentTime, duration],
  );

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio || !resolvedUrl) return;
    if (audio.paused) {
      if (duration > 0 && currentTime >= duration) audio.currentTime = 0;
      try {
        await audio.play();
      } catch {
        setAudioError(true);
      }
    } else {
      audio.pause();
    }
  };

  const seekAudio = (event: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(duration) || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  if (!mediaUrl) return null;

  if (loading && !resolvedUrl) {
    return <div className="flex min-h-20 items-center justify-center gap-2 rounded-xl bg-muted/70 px-4 py-5 text-sm text-muted-foreground"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />Loading attachment…</div>;
  }

  if (loadError) {
    return <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><span className="text-destructive">{loadError}</span><button type="button" onClick={() => void loadMedia()} className="w-fit rounded-lg bg-background px-3 py-1.5 font-medium shadow-sm">Try again</button></div>;
  }

  if (!resolvedUrl) return null;

  if (isAudio) {
    const shownTime = duration > 0 ? (playing ? currentTime : duration) : currentTime;
    return (
      <div className={`flex w-full min-w-[230px] max-w-[330px] items-center gap-3 rounded-2xl px-3 py-3 ${isMine ? "bg-primary-foreground/10" : "bg-muted/80"}`}>
        <audio ref={audioRef} src={resolvedUrl} preload="metadata" />
        <button type="button" onClick={() => void toggleAudio()} aria-label={playing ? "Pause voice note" : "Play voice note"} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${isMine ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"}`}>
          {playing ? "Ⅱ" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex h-9 items-center gap-[2px]" role="slider" aria-label="Voice note progress" aria-valuemin={0} aria-valuemax={duration || 0} aria-valuenow={currentTime} tabIndex={0} onClick={seekAudio} onKeyDown={(event) => {
            if (event.key === "ArrowRight" && audioRef.current && duration > 0) audioRef.current.currentTime = Math.min(duration, currentTime + 5);
            if (event.key === "ArrowLeft" && audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 5);
          }}>
            {WAVEFORM_BARS.map((height, index) => (
              <span key={index} className={`flex-1 rounded-full ${index / WAVEFORM_BARS.length <= progress ? (isMine ? "bg-primary-foreground" : "bg-primary") : (isMine ? "bg-primary-foreground/35" : "bg-muted-foreground/35")}`} style={{ height: `${height}%`, minWidth: 2 }} />
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums opacity-75">
            <span>{formatTime(currentTime)}</span>
            <span>{audioError ? "Can't play audio" : formatTime(duration)}</span>
          </div>
        </div>
        <span className="sr-only">{mediaName || "Voice message"}</span>
      </div>
    );
  }

  if (isImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          aria-label="Open image full screen"
          className="group relative block max-w-full overflow-hidden rounded-2xl text-left"
        >
          <img
            src={resolvedUrl}
            alt={mediaName || "Shared image"}
            loading="lazy"
            className="block max-h-[360px] max-w-full rounded-2xl object-contain transition-opacity group-active:opacity-90"
            onError={() => setLoadError("Image could not be displayed. Tap to retry.")}
          />
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 p-2 text-white opacity-90" aria-hidden="true">
            <Maximize2 size={16} />
          </span>
        </button>
        {previewOpen && (
          <div
            className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center bg-black p-0"
            role="dialog"
            aria-modal="true"
            aria-label="Full-screen image viewer"
            onClick={() => setPreviewOpen(false)}
          >
            <button
              type="button"
              aria-label="Close image viewer"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
            >
              <X size={22} />
            </button>
            <img
              src={resolvedUrl}
              alt={mediaName || "Shared image"}
              className="max-h-[100dvh] max-w-full select-none object-contain"
              onClick={(event) => event.stopPropagation()}
            />
            {mediaName && (
              <span className="absolute bottom-4 left-4 right-4 truncate text-center text-xs text-white/75">
                {mediaName}
              </span>
            )}
          </div>
        )}
      </>
    );
  }

  if (isVideo) {
    return (
      <>
        <div className="group relative my-1 max-w-full overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            src={resolvedUrl}
            controls
            playsInline
            preload="metadata"
            className="block max-h-[420px] w-full max-w-[min(78vw,420px)] rounded-2xl bg-black object-contain"
            onError={() => setLoadError("Video could not be played. Try reloading the attachment.")}
          />
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label="Open video full screen"
            title="Open full screen"
            className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white opacity-90 shadow transition hover:bg-black/85"
          >
            <Maximize2 size={17} />
          </button>
        </div>
        {previewOpen && (
          <div
            className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center bg-black p-0"
            role="dialog"
            aria-modal="true"
            aria-label="Full-screen video player"
          >
            <button
              type="button"
              aria-label="Close video viewer"
              onClick={() => {
                const player = document.getElementById("vidalore-fullscreen-chat-video") as HTMLVideoElement | null;
                player?.pause();
                setPreviewOpen(false);
              }}
              className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
            >
              <X size={22} />
            </button>
            <video
              id="vidalore-fullscreen-chat-video"
              src={resolvedUrl}
              controls
              autoPlay
              playsInline={false}
              preload="auto"
              className="h-full w-full object-contain"
              onError={() => setLoadError("Video could not be played in full-screen mode.")}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <a href={resolvedUrl} target="_blank" rel="noreferrer" download={mediaName || undefined} className="flex max-w-full items-center gap-3 rounded-xl bg-muted/80 p-3 text-sm hover:bg-muted">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-lg">{isPdf ? "📄" : "📎"}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{mediaName || "Download attachment"}</span>
      <span aria-hidden="true">↓</span>
    </a>
  );
}


export default MessageMediaRenderer;
