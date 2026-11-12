import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  FileText,
  Download,
  Maximize2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const CHAT_MEDIA_BUCKET = "chat-media";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function getChatMediaPath(value: string): string {
  const raw = value.trim();

  if (!raw || raw.startsWith("blob:")) {
    throw new Error("This attachment has no permanent storage path. It may be an old local-only upload.");
  }

  // New messages store the stable storage object path directly.
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, "");

  // Older messages may contain a Supabase signed/public URL. Extract its
  // object path and issue a fresh signed URL for the private bucket.
  const marker = `/storage/v1/object/`;
  const markerIndex = raw.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error("This attachment URL is not a supported chat-media URL.");
  }

  const afterMarker = raw.slice(markerIndex + marker.length);
  const bucketPrefix = afterMarker.match(/^(?:sign|public)\/chat-media\//);
  if (!bucketPrefix) {
    throw new Error("This attachment does not belong to the chat-media bucket.");
  }

  const encodedPath = afterMarker.slice(bucketPrefix[0].length).split("?")[0];
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function MessageMediaRenderer({
  messageType,
  mediaUrl,
  mediaName,
  isMine,
}: {
  messageType: string;
  mediaUrl: string;
  mediaName?: string | null;
  isMine: boolean;
}) {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolveRequestRef = useRef(0);

  const resolveMedia = useCallback(async () => {
    const requestId = ++resolveRequestRef.current;
    setIsLoading(true);
    setMediaError("");
    setResolvedUrl("");
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setAudioCurrentTime(0);
    setAudioDuration(0);

    try {
      const path = getChatMediaPath(mediaUrl);
      const { data, error } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error("The storage service did not return an attachment link.");

      if (requestId === resolveRequestRef.current) {
        setResolvedUrl(data.signedUrl);
        setIsLoading(false);
      }
    } catch (error) {
      if (requestId === resolveRequestRef.current) {
        setMediaError(
          error instanceof Error ? error.message : "Unable to load this attachment.",
        );
        setIsLoading(false);
      }
    }
  }, [mediaUrl]);

  useEffect(() => {
    void resolveMedia();
    return () => {
      resolveRequestRef.current += 1;
    };
  }, [resolveMedia, retryCount]);

  const handleMediaError = () => {
    // Refresh a signed link once automatically (for example, if an older
    // signed URL has expired). A manual retry remains available if it fails.
    if (retryCount === 0) {
      setRetryCount(1);
      return;
    }
    setMediaError("Unable to load attachment. Check your connection and try again.");
    setIsLoading(false);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedUrl || messageType !== "audio") return;

    const onTimeUpdate = () => {
      const duration = audio.duration;
      if (Number.isFinite(duration) && duration > 0) {
        setAudioCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
        setAudioProgress(Math.min(100, Math.max(0, (audio.currentTime / duration) * 100)));
      }
    };
    const onLoadedMetadata = () => {
      setAudioDuration(
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0,
      );
    };
    const onDurationChange = () => {
      setAudioDuration(
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0,
      );
    };
    const onEnded = () => {
      setIsPlayingAudio(false);
      setAudioCurrentTime(0);
      setAudioProgress(0);
    };
    const onPlay = () => setIsPlayingAudio(true);
    const onPause = () => setIsPlayingAudio(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [resolvedUrl, messageType]);

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      handleMediaError();
    }
  };

  const seekAudio = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const nextTime = Math.min(audio.duration, Math.max(0, value));
    audio.currentTime = nextTime;
    setAudioCurrentTime(nextTime);
    setAudioProgress((nextTime / audio.duration) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-secondary/70 p-3 text-xs text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        <span>Loading attachment…</span>
      </div>
    );
  }

  if (mediaError || !resolvedUrl) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
        <AlertCircle size={16} />
        <span className="min-w-0 flex-1">{mediaError || "Unable to load attachment."}</span>
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-current/30 px-2 py-1 font-medium"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      </div>
    );
  }

  // IMAGE
  if (messageType === "image") {
    return (
      <div className="my-1 overflow-hidden rounded-xl">
        <div
          className="group relative cursor-pointer"
          onClick={() => setImageModalOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setImageModalOpen(true);
          }}
          aria-label="Open image preview"
        >
          <img
            src={resolvedUrl}
            alt={mediaName || "Attached image"}
            className="max-h-72 w-full rounded-xl object-cover transition group-hover:opacity-95"
            loading="lazy"
            onError={handleMediaError}
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded-full bg-black/60 p-2 text-white">
              <Maximize2 size={16} />
            </span>
          </div>
        </div>

        <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
          <DialogContent className="flex max-w-4xl flex-col items-center justify-center border-none bg-black/95 p-1 shadow-2xl">
            <img
              src={resolvedUrl}
              alt={mediaName || "Image preview"}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              onError={handleMediaError}
            />
            {mediaName && (
              <p className="mt-2 max-w-md truncate text-xs text-white/70">{mediaName}</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // VIDEO
  if (messageType === "video") {
    return (
      <div className="my-1 max-w-full overflow-hidden rounded-xl">
        <video
          key={resolvedUrl}
          src={resolvedUrl}
          controls
          playsInline
          preload="metadata"
          className="max-h-72 w-full rounded-xl bg-black"
          onError={handleMediaError}
        />
        {mediaName && (
          <p className={`mt-1 truncate text-[10px] ${isMine ? "text-white/80" : "text-muted-foreground"}`}>
            {mediaName}
          </p>
        )}
      </div>
    );
  }

  // AUDIO / VOICE NOTE
  if (messageType === "audio") {
    return (
      <div
        className={`my-1 flex min-w-[210px] items-center gap-3 rounded-xl p-2.5 sm:min-w-[250px] ${
          isMine ? "bg-white/10 text-white" : "bg-secondary text-foreground"
        }`}
      >
        <audio
          ref={audioRef}
          key={resolvedUrl}
          src={resolvedUrl}
          preload="metadata"
          onError={handleMediaError}
        />
        <button
          type="button"
          onClick={() => void toggleAudio()}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm transition ${
            isMine
              ? "bg-white text-[#E91E63] hover:bg-white/90"
              : "bg-[#E91E63] text-white hover:bg-[#C2185B]"
          }`}
          aria-label={isPlayingAudio ? "Pause voice note" : "Play voice note"}
        >
          {isPlayingAudio ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={audioDuration > 0 ? audioDuration : 0}
            step={0.1}
            value={Math.min(audioCurrentTime, audioDuration || 0)}
            disabled={!audioDuration}
            onChange={(event) => seekAudio(Number(event.target.value))}
            aria-label="Seek voice note"
            className="h-2 w-full cursor-pointer accent-[#E91E63] disabled:cursor-default"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] opacity-80">
            <span>{formatSeconds(audioCurrentTime)}</span>
            <span>{formatSeconds(audioDuration)}</span>
          </div>
        </div>
      </div>
    );
  }

  // GENERIC FILE ATTACHMENT
  return (
    <div
      className={`my-1 flex items-center gap-3 rounded-xl border p-3 ${
        isMine
          ? "border-white/20 bg-white/10 text-white"
          : "border-border bg-secondary/80 text-foreground"
      }`}
    >
      <div className={`rounded-lg p-2 ${isMine ? "bg-white text-[#E91E63]" : "bg-[#E91E63]/10 text-[#E91E63]"}`}>
        <FileText size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{mediaName || "Attachment"}</p>
        <p className="text-[10px] opacity-75">{messageType.toUpperCase()}</p>
      </div>
      <a
        href={resolvedUrl}
        download={mediaName || "download"}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg p-1.5 transition hover:bg-black/10 dark:hover:bg-white/10"
        title="Download file"
        aria-label="Download attachment"
      >
        <Download size={16} />
      </a>
    </div>
  );
}
