import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type SyntheticEvent,
  type ChangeEvent,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Pause,
  UserPlus,
  UserCheck,
  Music,
  Eye,
  BadgeCheck,
  AlertCircle,
  RotateCcw,
  Loader2,
  Wrench,
  Upload,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { ReelCommentsDrawer } from "@/components/reels/ReelCommentsDrawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { followUser, unfollowUser, isFollowing as checkFollowing } from "@/services/relationships";
import {
  toggleReelLike,
  toggleReelSave,
  incrementReelShare,
  getFreshReelSignedUrl,
  updateReelVideo,
  transcodeExistingReel,
  deleteReel,
  type ReelItem,
} from "@/services/reelsAndStories";
import type { Profile } from "@/services/profiles";

export function ReelPlayer({
  reel: initialReel,
  isActive,
  isMuted,
  onToggleMute,
  me,
}: {
  reel: ReelItem;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  me?: Profile | null | undefined;
}) {
  const [reel, setReel] = useState<ReelItem>(initialReel);
  const [videoSrc, setVideoSrc] = useState<string>(initialReel.videoUrl || "");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(reel.isFollowing ?? false);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Video repair state
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState(0);
  const repairFileInputRef = useRef<HTMLInputElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Sync internal reel & videoSrc when initialReel changes
  useEffect(() => {
    setReel(initialReel);
    setVideoSrc(initialReel.videoUrl || "");
    setVideoError(false);
    setErrorMessage("");
    setIsLoading(true);
    setIsBuffering(false);
  }, [initialReel]);

  // Handle active / inactive playback lifecycle
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive && !videoError && !isRepairing) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
          })
          .catch((err) => {
            console.warn("Autoplay rejected or blocked by browser:", err);
            // If blocked due to unmuted audio policy, try muted autoplay
            if (!video.muted) {
              video.muted = true;
              video
                .play()
                .then(() => {
                  setIsPlaying(true);
                  setIsAutoplayBlocked(false);
                })
                .catch(() => {
                  setIsPlaying(false);
                  setIsAutoplayBlocked(true);
                });
            } else {
              setIsPlaying(false);
              setIsAutoplayBlocked(true);
            }
          });
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
      setIsPlaying(false);
    }
  }, [isActive, videoError, isRepairing]);

  // Synchronize mute attribute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Retry playback with fresh signed URL
  const handleRetry = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setVideoError(false);
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (reel.storagePath) {
        const freshUrl = await getFreshReelSignedUrl(reel.storagePath);
        if (freshUrl) {
          setVideoSrc(freshUrl);
        }
      }

      video.load();
      if (isActive) {
        await video.play();
        setIsPlaying(true);
        setIsAutoplayBlocked(false);
      }
    } catch (err) {
      console.warn("Retry failed:", err);
      // Let onError handle UI if reload fails
    }
  }, [isActive, reel.storagePath]);

  function handleVideoClick() {
    const video = videoRef.current;
    if (!video || videoError) return;

    if (video.paused) {
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsAutoplayBlocked(false);
        })
        .catch((err) => {
          console.warn("Play click error:", err);
          setIsPlaying(false);
        });
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 500);
    } else {
      video.pause();
      setIsPlaying(false);
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 500);
    }
  }

  function handleDoubleTap(e: React.MouseEvent) {
    e.stopPropagation();
    if (!reel.hasLiked) {
      handleLike();
    } else {
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 500);
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (video && video.duration > 0) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  }

  function handleLoadedMetadata() {
    setIsLoading(false);
  }

  function handleCanPlay() {
    setIsLoading(false);
    setIsBuffering(false);
  }

  function handlePlaying() {
    setIsPlaying(true);
    setIsLoading(false);
    setIsBuffering(false);
    setIsAutoplayBlocked(false);
  }

  function handleWaiting() {
    setIsBuffering(true);
  }

  function handleStalled() {
    setIsBuffering(true);
  }

  function handleEnded() {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }

  function handleVideoError(e: SyntheticEvent<HTMLVideoElement, Event>) {
    e.stopPropagation();
    const video = videoRef.current;
    const mediaErr = video?.error;

    let msg = "Video playback failed.";
    if (mediaErr) {
      switch (mediaErr.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          msg = "Video playback was aborted.";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          msg = "A network error caused the video download to fail.";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          msg = "Video decoding failed. The format may be unsupported on this device.";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          msg =
            "The video format or codec (such as unconverted HEVC/H.265) is not supported by this browser.";
          break;
      }
    }

    setVideoError(true);
    setErrorMessage(msg);
    setIsLoading(false);
    setIsBuffering(false);
    setIsPlaying(false);
  }

  // Handle re-upload / transcode for existing unsupported reel video
  async function handleRepairFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRepairing(true);
    setRepairProgress(0);

    try {
      const updated = await updateReelVideo(reel.id, file, (p) => {
        setRepairProgress(p);
      });

      setReel(updated);
      setVideoSrc(updated.videoUrl);
      setVideoError(false);
      setErrorMessage("");
      setIsLoading(true);

      toast.success("Reel video updated successfully", {
        description: "The video has been converted to H.264 MP4 and is now ready for playback.",
      });

      setTimeout(() => {
        handleRetry();
      }, 200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update reel video.");
    } finally {
      setIsRepairing(false);
      setRepairProgress(0);
      if (repairFileInputRef.current) repairFileInputRef.current.value = "";
    }
  }

  async function handleAutoTranscode() {
    setIsRepairing(true);
    setRepairProgress(0);

    try {
      const updated = await transcodeExistingReel(reel.id, (p) => {
        setRepairProgress(p);
      });

      setReel(updated);
      setVideoSrc(updated.videoUrl);
      setVideoError(false);
      setErrorMessage("");
      setIsLoading(true);

      toast.success("Reel video auto-repaired successfully", {
        description: "Re-encoded to H.264 MP4 with AAC audio.",
      });

      setTimeout(() => {
        handleRetry();
      }, 200);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Auto-repair could not decode this video. Please use 'Upload Converted Video'.",
      );
    } finally {
      setIsRepairing(false);
      setRepairProgress(0);
    }
  }

  function handleLike() {
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 500);

    const prevLiked = reel.hasLiked ?? false;
    const prevCount = reel.likesCount;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    // Immediate optimistic update
    setReel((prev) => ({
      ...prev,
      hasLiked: nextLiked,
      likesCount: nextCount,
    }));

    void toggleReelLike(reel.id)
      .then((res) => {
        setReel((prev) => ({
          ...prev,
          hasLiked: res.hasLiked,
          likesCount: res.likesCount,
        }));
      })
      .catch((error) => {
        setReel((prev) => ({
          ...prev,
          hasLiked: prevLiked,
          likesCount: prevCount,
        }));
        toast.error(error instanceof Error ? error.message : "Could not update like.");
      });
  }

  function handleSave() {
    const prevSaved = reel.hasSaved ?? false;
    const prevCount = reel.savesCount;
    const nextSaved = !prevSaved;
    const nextCount = Math.max(0, prevCount + (nextSaved ? 1 : -1));

    setReel((prev) => ({
      ...prev,
      hasSaved: nextSaved,
      savesCount: nextCount,
    }));
    toast.info(nextSaved ? "Saved to your bookmarks 🌹" : "Removed from saved");

    void toggleReelSave(reel.id)
      .then((saved) => {
        setReel((prev) => ({
          ...prev,
          hasSaved: saved,
        }));
      })
      .catch((error) => {
        setReel((prev) => ({
          ...prev,
          hasSaved: prevSaved,
          savesCount: prevCount,
        }));
        toast.error(error instanceof Error ? error.message : "Could not update saved reel.");
      });
  }

  async function handleFollowToggle() {
    if (!me?.id || me.id === reel.creatorId || isFollowPending) return;

    const previous = isFollowing;
    const next = !previous;
    setIsFollowing(next);
    setIsFollowPending(true);

    try {
      if (next) {
        await followUser(reel.creatorId);
      } else {
        await unfollowUser(reel.creatorId);
      }
      toast.success(
        next ? `Following @${reel.creatorUsername}` : `Unfollowed @${reel.creatorUsername}`,
      );
    } catch (error) {
      setIsFollowing(previous);
      toast.error(error instanceof Error ? error.message : "Could not update follow status.");
    } finally {
      setIsFollowPending(false);
    }
  }

  async function handleShare() {
    const shareUrl = `${window.location.origin}/reels?reelId=${encodeURIComponent(reel.id)}`;
    let shareConfirmed = false;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `@${reel.creatorUsername} on VIDALORE Reels`,
          text: reel.caption ? reel.caption.slice(0, 80) : "Watch this Reel on VIDALORE SOCIAL",
          url: shareUrl,
        });
        shareConfirmed = true;
        toast.success("Reel shared successfully 🌹");
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // Explicitly cancelled by user - do NOT count or toast
          return;
        }
        // Fallback to clipboard if share failed for non-abort reasons
        try {
          await navigator.clipboard.writeText(shareUrl);
          shareConfirmed = true;
          toast.success("Reel link copied to clipboard 🌹");
        } catch {
          toast.error("Could not share or copy link.");
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        shareConfirmed = true;
        toast.success("Reel link copied to clipboard 🌹");
      } catch {
        toast.error("Could not copy reel link.");
      }
    }

    if (shareConfirmed) {
      setReel((prev) => ({
        ...prev,
        sharesCount: prev.sharesCount + 1,
      }));
      void incrementReelShare(reel.id).catch(() => {});
    }
  }

  const isOwner = Boolean(me && me.id === reel.creatorId);

  async function handleDeleteReel() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteReel(reel.id);
      toast.success("Reel deleted successfully");
      setConfirmDeleteOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete reel.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="relative h-full w-full max-w-md mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-black select-none shadow-xl border border-white/10 group">
      {/* Hidden File Input for Reel Video Repair */}
      <input
        ref={repairFileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={handleRepairFileSelect}
      />

      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoSrc || undefined}
        className="h-full w-full object-cover cursor-pointer"
        loop
        playsInline
        preload="auto"
        muted={isMuted}
        onClick={handleVideoClick}
        onDoubleClick={handleDoubleTap}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onWaiting={handleWaiting}
        onStalled={handleStalled}
        onEnded={handleEnded}
        onError={handleVideoError}
      />

      {/* Loading / Buffering Spinner */}
      {(isLoading || isBuffering) && !videoError && !isRepairing && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10 animate-fade-in">
          <Loader2 className="h-10 w-10 text-[#E91E63] animate-spin mb-2" />
          <span className="text-xs font-medium text-white/90 drop-shadow">
            {isLoading ? "Loading Reel..." : "Buffering..."}
          </span>
        </div>
      )}

      {/* Autoplay Blocked Tap-to-Play Overlay */}
      {isAutoplayBlocked && !isPlaying && !videoError && !isLoading && !isRepairing && (
        <div
          onClick={handleVideoClick}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 cursor-pointer z-10 animate-fade-in"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/70 text-white shadow-xl backdrop-blur-md hover:scale-105 active:scale-95 transition-all">
            <Play className="h-8 w-8 ml-1 fill-current" />
          </span>
          <p className="mt-3 text-xs font-semibold text-white drop-shadow">Tap to play video</p>
        </div>
      )}

      {/* Video Playback Error Fallback with Retry & Creator Repair Tools */}
      {videoError && !isRepairing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-6 text-center space-y-3 z-30 animate-fade-in">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
            <AlertCircle className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold">Video Playback Error</p>
          <p className="text-xs text-white/80 max-w-xs leading-relaxed">
            {errorMessage || "The media source is currently unsupported or could not be loaded."}
          </p>

          <div className="flex flex-col gap-2 w-full max-w-xs pt-1">
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#E91E63] hover:bg-[#C2185B] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry Playback
            </button>

            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => repairFileInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border px-4 py-2 text-xs font-semibold text-foreground transition-colors"
                >
                  <Upload className="h-3.5 w-3.5 text-[#E91E63]" /> Re-upload / Transcode Video
                </button>

                <button
                  type="button"
                  onClick={handleAutoTranscode}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-card/60 hover:bg-card border border-border/70 px-3 py-1.5 text-[0.7rem] text-muted-foreground transition-colors"
                >
                  <Wrench className="h-3 w-3" /> Attempt In-Browser Auto-Repair
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* In-Progress Repair Overlay */}
      {isRepairing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white p-6 text-center space-y-3 z-30 animate-fade-in">
          <Loader2 className="h-10 w-10 text-[#E91E63] animate-spin" />
          <p className="text-sm font-semibold">Repairing Reel Video...</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Converting video into web-compatible H.264 MP4 with AAC audio.
          </p>
          <div className="w-full max-w-xs space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-[#E91E63] transition-all duration-200"
                style={{ width: `${repairProgress}%` }}
              />
            </div>
            <p className="text-[0.65rem] text-muted-foreground text-right">{repairProgress}%</p>
          </div>
        </div>
      )}

      {/* Floating double-tap heart animation */}
      {heartBurst && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center animate-ping z-20">
          <Heart className="h-20 w-20 fill-[#E91E63] text-[#E91E63]" />
        </div>
      )}

      {/* Play/Pause center overlay indicator */}
      {showPlayIcon && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center animate-fade-in z-20">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
            {isPlaying ? <Play className="h-7 w-7 ml-0.5" /> : <Pause className="h-7 w-7" />}
          </span>
        </div>
      )}

      {/* Top Controls */}
      <div className="absolute top-4 inset-x-4 flex items-center justify-between z-20 pointer-events-auto">
        <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[0.7rem] text-white/90 backdrop-blur-sm">
          <Eye className="h-3 w-3" />
          <span>{reel.viewsCount.toLocaleString()}</span>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
          aria-label={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4 text-[#E91E63]" />
          )}
        </button>
      </div>

      {/* Right-Side Vertical Action Column */}
      <div className="absolute right-3 bottom-16 flex flex-col items-center gap-3.5 z-20 pointer-events-auto">
        {/* Creator Avatar with Follow Button */}
        <div className="relative mb-1">
          <Link to="/u/$username" params={{ username: reel.creatorUsername }}>
            <UserAvatar
              profile={{
                avatar_url: reel.creatorAvatarUrl,
                username: reel.creatorUsername,
                display_name: reel.creatorName,
              }}
              className="h-10 w-10 ring-2 ring-[#E91E63]"
            />
          </Link>
          {me?.id !== reel.creatorId && (
            <button
              type="button"
              onClick={handleFollowToggle}
              disabled={isFollowPending}
              className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full border border-background shadow transition-transform active:scale-90 ${
                isFollowing ? "bg-card text-foreground" : "bg-[#E91E63] text-white"
              }`}
              title={isFollowing ? "Following" : "Follow"}
            >
              {isFollowing ? (
                <UserCheck className="h-2.5 w-2.5" />
              ) : (
                <UserPlus className="h-2.5 w-2.5" />
              )}
            </button>
          )}
        </div>

        {/* Heart Like Action */}
        <button
          type="button"
          onClick={handleLike}
          className="flex flex-col items-center gap-0.5 group/btn"
          aria-label={reel.hasLiked ? "Unlike reel" : "Like reel"}
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-transform active:scale-125 ${
              reel.hasLiked ? "text-[#E91E63]" : "text-white"
            }`}
          >
            <Heart className={`h-5 w-5 ${reel.hasLiked ? "fill-[#E91E63] text-[#E91E63]" : ""}`} />
          </span>
          <span className="text-[0.65rem] font-semibold text-white drop-shadow">
            {reel.likesCount}
          </span>
        </button>

        {/* Comments Action */}
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="flex flex-col items-center gap-0.5"
          aria-label="Comments"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-transform active:scale-110">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="text-[0.65rem] font-semibold text-white drop-shadow">
            {reel.commentsCount}
          </span>
        </button>

        {/* Share Action */}
        <button
          type="button"
          onClick={handleShare}
          className="flex flex-col items-center gap-0.5"
          aria-label="Share"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-transform active:scale-110">
            <Share2 className="h-5 w-5" />
          </span>
          <span className="text-[0.65rem] font-semibold text-white drop-shadow">
            {reel.sharesCount}
          </span>
        </button>

        {/* Save Action */}
        <button
          type="button"
          onClick={handleSave}
          className="flex flex-col items-center gap-0.5"
          aria-label="Save"
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-transform active:scale-110 ${
              reel.hasSaved ? "text-[#E91E63]" : "text-white hover:bg-black/80"
            }`}
          >
            <Bookmark className={`h-5 w-5 ${reel.hasSaved ? "fill-[#E91E63]" : ""}`} />
          </span>
          <span className="text-[0.65rem] font-semibold text-white drop-shadow">
            {reel.savesCount}
          </span>
        </button>

        {/* Delete Action (Owner Only) */}
        {isOwner && (
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="flex flex-col items-center gap-0.5"
            aria-label="Delete reel"
            title="Delete your reel"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-sm hover:bg-destructive/80 hover:text-white transition-colors active:scale-110">
              <Trash2 className="h-4 w-4" />
            </span>
            <span className="text-[0.65rem] font-semibold text-white drop-shadow">Delete</span>
          </button>
        )}
      </div>

      {/* Bottom Creator Information Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 pt-16 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-auto">
        <div className="pr-14 space-y-1.5">
          <Link
            to="/u/$username"
            params={{ username: reel.creatorUsername }}
            className="inline-flex items-center gap-1.5 group/user"
          >
            <span className="text-sm font-bold text-white group-hover/user:text-[#E91E63] transition-colors">
              @{reel.creatorUsername}
            </span>
            {reel.creatorVerified && <BadgeCheck className="h-4 w-4 text-[#E91E63]" />}
          </Link>

          {/* Caption with expander */}
          <p
            onClick={() => setCaptionExpanded(!captionExpanded)}
            className={`text-xs text-white/95 leading-relaxed cursor-pointer drop-shadow ${
              captionExpanded ? "" : "line-clamp-2"
            }`}
          >
            {reel.caption}
          </p>

          {/* Audio Title */}
          {reel.audioTitle && (
            <div className="flex items-center gap-1.5 text-[0.7rem] text-white/80 pt-1">
              <Music className="h-3 w-3 shrink-0 text-[#E91E63]" />
              <span className="truncate">{reel.audioTitle}</span>
            </div>
          )}
        </div>

        {/* Playback Progress Bar */}
        <div className="mt-3 h-1 w-full bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#E91E63] transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Reel Comments Drawer */}
      <ReelCommentsDrawer
        reelId={reel.id}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        me={me}
        onCommentAdded={() => {
          setReel((prev) => ({ ...prev, commentsCount: prev.commentsCount + 1 }));
        }}
      />

      {/* Delete Reel Confirmation Modal */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="border border-border bg-card rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-base text-foreground">
              Delete Reel?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete this reel? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg text-xs" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteReel();
              }}
              disabled={isDeleting}
              className="rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold"
            >
              {isDeleting ? "Deleting..." : "Delete Reel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
