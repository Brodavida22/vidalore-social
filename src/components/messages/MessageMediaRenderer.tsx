import { useState, useRef, useEffect } from "react";
import { Play, Pause, FileText, Download, Maximize2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
  const [mediaError, setMediaError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio lifecycle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const onLoadedMetadata = () => {
      setAudioDuration(audio.duration || 0);
    };
    const onEnded = () => {
      setIsPlayingAudio(false);
      setAudioProgress(0);
    };
    const onError = (e: Event) => {
      e.stopPropagation?.();
      setMediaError(true);
      setIsPlayingAudio(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => setMediaError(true));
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (mediaError) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
        <AlertCircle size={16} />
        <span>Unable to load attachment</span>
      </div>
    );
  }

  // 1. IMAGE
  if (messageType === "image") {
    return (
      <div className="overflow-hidden rounded-xl my-1">
        <div className="relative group cursor-pointer" onClick={() => setImageModalOpen(true)}>
          <img
            src={mediaUrl}
            alt={mediaName || "Attached image"}
            className="max-h-72 w-full object-cover rounded-xl transition group-hover:opacity-95"
            loading="lazy"
            onError={() => setMediaError(true)}
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
            <span className="p-2 rounded-full bg-black/60 text-white">
              <Maximize2 size={16} />
            </span>
          </div>
        </div>

        {/* Lightbox / Zoom Dialog */}
        <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
          <DialogContent className="max-w-4xl p-1 bg-black/95 border-none shadow-2xl flex flex-col items-center justify-center">
            <img
              src={mediaUrl}
              alt={mediaName || "Image preview"}
              className="max-h-[85vh] max-w-full object-contain rounded-lg"
            />
            {mediaName && (
              <p className="text-xs text-white/70 mt-2 truncate max-w-md">{mediaName}</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // 2. VIDEO
  if (messageType === "video") {
    return (
      <div className="overflow-hidden rounded-xl my-1 max-w-full">
        <video
          src={mediaUrl}
          controls
          playsInline
          preload="metadata"
          className="max-h-72 w-full rounded-xl bg-black"
          onError={(e) => {
            e.stopPropagation();
            setMediaError(true);
          }}
        />
        {mediaName && (
          <p
            className={`text-[10px] mt-1 truncate ${
              isMine ? "text-white/80" : "text-muted-foreground"
            }`}
          >
            {mediaName}
          </p>
        )}
      </div>
    );
  }

  // 3. AUDIO / VOICE NOTE
  if (messageType === "audio") {
    return (
      <div
        className={`flex items-center gap-3 p-2.5 rounded-xl min-w-[200px] sm:min-w-[240px] my-1 ${
          isMine ? "bg-white/10 text-white" : "bg-secondary text-foreground"
        }`}
      >
        <audio
          ref={audioRef}
          src={mediaUrl}
          preload="metadata"
          onError={(e) => {
            e.stopPropagation();
            setMediaError(true);
          }}
        />

        <button
          type="button"
          onClick={toggleAudio}
          className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition shadow-sm ${
            isMine
              ? "bg-white text-[#E91E63] hover:bg-white/90"
              : "bg-[#E91E63] text-white hover:bg-[#C2185B]"
          }`}
          aria-label={isPlayingAudio ? "Pause voice note" : "Play voice note"}
        >
          {isPlayingAudio ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="h-2 w-full rounded-full bg-black/20 dark:bg-white/20 overflow-hidden relative">
            <div
              className={`h-full transition-all ${isMine ? "bg-white" : "bg-[#E91E63]"}`}
              style={{ width: `${audioProgress}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1 text-[10px] opacity-80">
            <span>Voice note</span>
            <span>{formatSeconds(audioDuration)}</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. GENERIC FILE ATTACHMENT
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border my-1 ${
        isMine
          ? "border-white/20 bg-white/10 text-white"
          : "border-border bg-secondary/80 text-foreground"
      }`}
    >
      <div
        className={`p-2 rounded-lg ${
          isMine ? "bg-white text-[#E91E63]" : "bg-[#E91E63]/10 text-[#E91E63]"
        }`}
      >
        <FileText size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{mediaName || "Attachment"}</p>
        <p className="text-[10px] opacity-75">{messageType.toUpperCase()}</p>
      </div>
      <a
        href={mediaUrl}
        download={mediaName || "download"}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition"
        title="Download file"
      >
        <Download size={16} />
      </a>
    </div>
  );
}
