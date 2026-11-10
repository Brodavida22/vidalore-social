import { useState, useRef, useEffect, type SyntheticEvent } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { getFreshSignedUrl } from "@/services/posts";

interface PostVideoPlayerProps {
  url: string;
  storagePath?: string | undefined;
  className?: string | undefined;
  aspectClass?: string | undefined;
  autoPlay?: boolean | undefined;
}

export function PostVideoPlayer({
  url,
  storagePath,
  className = "",
  aspectClass,
  autoPlay = false,
}: PostVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [src, setSrc] = useState(url);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if prop url changes
  useEffect(() => {
    setSrc(url);
    setHasError(false);
  }, [url]);

  // Handle play/pause toggle safely
  async function togglePlay() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn("Playback error/autoplay prevented:", err);
        setIsPlaying(false);
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    setHasError(false);
    setIsBuffering(false);
    if (autoPlay) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pos * duration;
    setCurrentTime(video.currentTime);
  }

  function handleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch((err) => console.warn(err));
    } else {
      document.exitFullscreen?.().catch((err) => console.warn(err));
    }
  }

  async function handleRefreshUrl() {
    if (!storagePath) {
      setHasError(false);
      videoRef.current?.load();
      return;
    }
    setIsRefreshing(true);
    try {
      const fresh = await getFreshSignedUrl(storagePath);
      if (fresh) {
        setSrc(fresh);
        setHasError(false);
        setTimeout(() => {
          videoRef.current?.load();
          videoRef.current
            ?.play()
            .then(() => setIsPlaying(true))
            .catch(() => {});
        }, 100);
      }
    } catch {
      // keep error state
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleVideoError(_e: SyntheticEvent<HTMLVideoElement, Event>) {
    setHasError(true);
    setIsBuffering(false);
    setIsPlaying(false);
  }

  function handleMouseMove() {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
      className={`relative group overflow-hidden bg-black flex items-center justify-center select-none ${
        aspectClass || "aspect-video max-h-[520px] w-full"
      } ${className}`}
    >
      {/* Error State */}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center z-20">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-xs text-white/90 font-medium mb-1">Video could not be played</p>
          <p className="text-[11px] text-white/60 mb-3 max-w-xs">
            The media URL may have expired or format is unsupported.
          </p>
          <button
            type="button"
            onClick={handleRefreshUrl}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#E91E63] hover:bg-[#C2185B] px-3 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            {isRefreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Reload video
          </button>
        </div>
      ) : null}

      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={handleVideoError}
        onClick={togglePlay}
        className="h-full w-full object-contain cursor-pointer"
      />

      {/* Buffering Indicator */}
      {isBuffering && !hasError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 z-10">
          <Loader2 className="h-8 w-8 text-[#E91E63] animate-spin" />
        </div>
      )}

      {/* Center Big Play Button (when paused) */}
      {!isPlaying && !hasError && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10">
          <button
            type="button"
            onClick={togglePlay}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/70 hover:bg-[#E91E63] text-white shadow-lg backdrop-blur-md hover:scale-105 active:scale-95 transition-all"
            aria-label="Play video"
          >
            <Play className="h-6 w-6 ml-0.5 fill-current" />
          </button>
        </div>
      )}

      {/* Video Controls Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-6 flex flex-col gap-1.5 z-20 transition-opacity duration-200 ${
          controlsVisible || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress Track / Scrub bar */}
        <div
          onClick={handleSeek}
          className="relative h-1.5 hover:h-2.5 w-full bg-white/20 rounded-full cursor-pointer transition-all flex items-center"
        >
          <div
            className="h-full bg-[#E91E63] rounded-full relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1 hover:text-[#E91E63] transition-colors rounded"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              className="p-1 hover:text-[#E91E63] transition-colors rounded"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <span className="text-[11px] font-mono text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleFullscreen}
              className="p-1 hover:text-[#E91E63] transition-colors rounded"
              aria-label="Fullscreen"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
