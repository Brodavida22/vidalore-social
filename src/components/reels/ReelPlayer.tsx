import { useState, useRef, useEffect } from "react";
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
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { ReelCommentsDrawer } from "@/components/reels/ReelCommentsDrawer";
import { toggleFollow } from "@/services/social";
import { toggleReelLike, toggleReelSave, type ReelItem } from "@/services/reelsAndStories";
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
  me?: Profile | null;
}) {
  const [reel, setReel] = useState<ReelItem>(initialReel);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(reel.isFollowing ?? false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Sync playback with isActive
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay blocked by browser policy without user gesture
            setIsPlaying(false);
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  function handleVideoClick() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true));
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
      setTimeout(() => setHeartBurst(false), 600);
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (video && video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  }

  function handleLike() {
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 600);
    void toggleReelLike(reel.id).then((updated) => { if (updated) setReel({ ...updated }); }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not update like."));
  }

  function handleSave() {
    void toggleReelSave(reel.id).then((saved) => {
      setReel((prev) => ({ ...prev, hasSaved: saved, savesCount: Math.max(0, prev.savesCount + (saved ? 1 : -1)) }));
      toast.info(saved ? "Saved to your Rose Collection 🌹" : "Removed from saved");
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not update saved reel."));
  }

  function handleFollowToggle() {
    const next = toggleFollow(reel.creatorId);
    setIsFollowing(next);
    toast.info(
      next ? `Following @${reel.creatorUsername} 🌹` : `Unfollowed @${reel.creatorUsername}`,
    );
  }

  async function handleShare() {
    const url = `${window.location.origin}/reels`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `@${reel.creatorUsername} on VIDALORE Reels`,
          text: reel.caption.slice(0, 80),
          url,
        });
        toast.success("Shared reel 🌹");
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Reel link copied to clipboard");
    }
  }

  return (
    <div className="relative h-full w-full max-w-md mx-auto aspect-[9/16] rounded-3xl overflow-hidden bg-black select-none shadow-2xl border border-border/40 group">
      {/* Video Element */}
      <video
        ref={videoRef}
        src={reel.videoUrl}
        className="h-full w-full object-cover cursor-pointer"
        loop
        playsInline
        muted={isMuted}
        onClick={handleVideoClick}
        onDoubleClick={handleDoubleTap}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Floating double-tap heart animation */}
      {heartBurst && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center animate-ping">
          <span className="text-7xl drop-shadow-[0_0_20px_var(--color-primary)]">🌹</span>
        </div>
      )}

      {/* Play/Pause center overlay indicator */}
      {showPlayIcon && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center animate-fade-in">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md">
            {isPlaying ? <Play className="h-8 w-8 ml-1" /> : <Pause className="h-8 w-8" />}
          </span>
        </div>
      )}

      {/* Top Controls: Sound toggle & Views */}
      <div className="absolute top-4 inset-x-4 flex items-center justify-between z-20 pointer-events-auto">
        <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[0.7rem] text-rose-soft backdrop-blur-md">
          <Eye className="h-3 w-3" />
          <span>{reel.viewsCount.toLocaleString()}</span>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-colors"
          aria-label={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-primary" />}
        </button>
      </div>

      {/* Right-Side Vertical Action Column */}
      <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4 z-20 pointer-events-auto">
        {/* Creator Avatar with Follow Button */}
        <div className="relative mb-1">
          <Link to="/u/$username" params={{ username: reel.creatorUsername }}>
            <UserAvatar
              profile={{
                avatar_url: reel.creatorAvatarUrl,
                username: reel.creatorUsername,
                display_name: reel.creatorName,
              }}
              className="h-11 w-11 ring-2 ring-primary shadow-glow"
            />
          </Link>
          {me?.id !== reel.creatorId && (
            <button
              type="button"
              onClick={handleFollowToggle}
              className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full border border-background shadow-md transition-transform active:scale-90 ${
                isFollowing ? "bg-secondary text-foreground" : "bg-gradient-rose text-white"
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

        {/* 🌹 Rose Like Action */}
        <button
          type="button"
          onClick={handleLike}
          className="flex flex-col items-center gap-0.5 group/btn"
          aria-label={reel.hasLiked ? "Unlike reel" : "Rose like reel"}
        >
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-2xl transition-transform active:scale-125 ${
              reel.hasLiked ? "drop-shadow-[0_0_12px_var(--color-primary)]" : "opacity-85"
            }`}
          >
            🌹
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
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-transform active:scale-110">
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
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-transform active:scale-110">
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
            className={`flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-md transition-transform active:scale-110 ${
              reel.hasSaved ? "text-primary bg-primary/20" : "text-white hover:bg-black/70"
            }`}
          >
            <Bookmark className={`h-5 w-5 ${reel.hasSaved ? "fill-primary" : ""}`} />
          </span>
          <span className="text-[0.65rem] font-semibold text-white drop-shadow">
            {reel.savesCount}
          </span>
        </button>
      </div>

      {/* Bottom Creator Information Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 pt-16 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-auto">
        <div className="pr-14 space-y-1.5">
          {/* Creator name & badge */}
          <Link
            to="/u/$username"
            params={{ username: reel.creatorUsername }}
            className="inline-flex items-center gap-1.5 group/user"
          >
            <span className="text-sm font-bold text-white group-hover/user:text-rose-soft transition-colors">
              @{reel.creatorUsername}
            </span>
            {reel.creatorVerified && (
              <span className="text-primary text-xs" title="Verified Gardener">
                🌹
              </span>
            )}
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

          {/* Sound / Music Tag */}
          {reel.audioTitle && (
            <div className="flex items-center gap-1.5 text-[0.7rem] text-rose-soft/90 pt-1">
              <Music className="h-3 w-3 animate-spin duration-3000 shrink-0 text-primary" />
              <span className="truncate">{reel.audioTitle}</span>
            </div>
          )}
        </div>

        {/* Bottom Playback Progress Bar */}
        <div className="mt-3 h-1 w-full bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-rose transition-all duration-100 ease-linear shadow-glow"
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
    </div>
  );
}
