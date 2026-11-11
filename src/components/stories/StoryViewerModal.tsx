import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { X, Send, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Input } from "@/components/ui/input";
import { markStorySeen, type UserStoryGroup, type StoryItem } from "@/services/reelsAndStories";
import type { Profile } from "@/services/profiles";

const STORY_DURATION_MS = 5000;
const QUICK_REACTIONS = ["👍", "❤️", "🔥", "👏", "💡", "🙌"];

export function StoryViewerModal({
  storyGroups,
  initialGroupIndex = 0,
  open,
  onClose,
  me,
}: {
  storyGroups: UserStoryGroup[];
  initialGroupIndex?: number | undefined;
  open: boolean;
  onClose: () => void;
  me?: Profile | null | undefined;
}) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  const currentGroup = storyGroups[groupIndex];
  const currentStory: StoryItem | undefined = currentGroup?.stories[storyIndex];

  useEffect(() => {
    setGroupIndex(initialGroupIndex);
    setStoryIndex(0);
    setProgress(0);
    setVideoLoading(true);
    setVideoError(false);
  }, [initialGroupIndex, open]);

  useEffect(() => {
    setProgress(0);
    setVideoLoading(currentStory?.mediaType === "video");
    setVideoError(false);
  }, [currentStory?.id]);

  useEffect(() => {
    if (currentStory && me && open) {
      void markStorySeen(currentStory.id, me.id).catch((error) =>
        console.error("Could not record story view", error),
      );
    }
  }, [currentStory?.id, me?.id, open]);

  const handleNext = useCallback(() => {
    if (!currentGroup) return;

    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      setProgress(0);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentGroup, storyIndex, groupIndex, storyGroups.length, onClose]);

  const handlePrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      const prevGroup = storyGroups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(prevGroup ? prevGroup.stories.length - 1 : 0);
      setProgress(0);
    }
  }, [storyIndex, groupIndex, storyGroups]);

  // Images advance after five seconds.
  // Videos advance only when their playback finishes.
  useEffect(() => {
    if (!open || isPaused || !currentStory || currentStory.mediaType === "video") {
      return;
    }

    const interval = 50;
    const step = (interval / STORY_DURATION_MS) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;

        if (next >= 100) {
          clearInterval(timer);
          handleNext();
          return 100;
        }

        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [open, isPaused, currentStory?.id, handleNext]);

  function handleSendReply() {
    if (!replyText.trim()) return;

    toast.success(`Reply sent to @${currentGroup?.username}`);
    setReplyText("");
  }

  function handleQuickReaction(emoji: string) {
    toast.success(`Sent ${emoji} to @${currentGroup?.username}`);
  }

  if (!open || !currentGroup || !currentStory) return null;

  const timeAgo = formatStoryTime(new Date(currentStory.createdAt));

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none animate-fade-in"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="relative h-full w-full max-w-sm sm:max-h-[92vh] sm:rounded-2xl overflow-hidden bg-black flex flex-col justify-between shadow-2xl border border-white/10">
        {/* Media Background */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
          {currentStory.mediaType === "video" ? (
            <>
              <video
                key={currentStory.id}
                src={currentStory.mediaUrl}
                autoPlay
                muted
                loop={false}
                playsInline
                preload="auto"
                controls={false}
                className="h-full w-full object-contain"
                onLoadStart={() => {
                  setVideoLoading(true);
                  setVideoError(false);
                }}
                onCanPlay={() => {
                  setVideoLoading(false);
                  setVideoError(false);
                }}
                onPlaying={() => {
                  setVideoLoading(false);
                  setVideoError(false);
                }}
                onWaiting={() => setVideoLoading(true)}
                onEnded={handleNext}
                onError={(event) => {
                  console.error(
                    "Story video playback error:",
                    event.currentTarget.error,
                    currentStory.mediaUrl,
                  );
                  setVideoLoading(false);
                  setVideoError(true);
                }}
              />

              {videoLoading && !videoError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 text-white pointer-events-none">
                  <Loader2 className="h-8 w-8 animate-spin text-[#E91E63]" />
                  <p className="text-xs text-white/80">Loading your story video...</p>
                </div>
              )}

              {videoError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black text-white">
                  <AlertCircle className="h-10 w-10 text-red-400" />
                  <p className="text-sm font-semibold">Video could not be played</p>
                  <p className="max-w-[240px] text-center text-xs text-white/60">
                    Check your internet connection or try uploading the video again.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoError(false);
                      setVideoLoading(true);
                      const video = document.querySelector("video");
                      if (video) {
                        video.load();
                        void video.play().catch((error) => {
                          console.error("Video retry failed:", error);
                        });
                      }
                    }}
                    className="rounded-lg bg-[#E91E63] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Retry video
                  </button>
                </div>
              )}
            </>
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className="h-full w-full object-contain"
              onError={() => {
                console.error("Story image could not be loaded:", currentStory.mediaUrl);
              }}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80 pointer-events-none" />
        </div>

        {/* Tap navigation zones */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute inset-y-16 left-0 w-2/5 z-10 cursor-pointer"
        />

        <div
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute inset-y-16 right-0 w-3/5 z-10 cursor-pointer"
        />

        {/* Top Header & Progress Bar */}
        <div className="relative z-20 p-4 space-y-3 pointer-events-auto">
          <div className="flex gap-1 items-center">
            {currentGroup.stories.map((s, idx) => {
              const isPast = idx < storyIndex;
              const isCurrent = idx === storyIndex;

              return (
                <div key={s.id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-75"
                    style={{
                      width: isPast
                        ? "100%"
                        : isCurrent
                          ? `${currentStory.mediaType === "video" ? 0 : progress}%`
                          : "0%",
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <Link
              to="/u/$username"
              params={{ username: currentGroup.username }}
              onClick={onClose}
              className="flex items-center gap-2.5 group"
            >
              <UserAvatar
                profile={{
                  avatar_url: currentGroup.avatarUrl,
                  username: currentGroup.username,
                  display_name: currentGroup.displayName,
                }}
                className="h-8 w-8 text-xs ring-1 ring-white/50"
              />

              <div>
                <p className="text-xs font-semibold text-white group-hover:text-primary transition-colors truncate max-w-[140px]">
                  {currentGroup.displayName}
                </p>
                <p className="text-[0.65rem] text-white/70">
                  @{currentGroup.username} · {timeAgo}
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/50 p-1.5 text-white hover:bg-black/80 transition-colors"
              aria-label="Close stories"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Story Caption */}
        {currentStory.caption && (
          <div className="relative z-20 mx-4 my-auto p-3 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs text-center font-medium border border-white/10 pointer-events-none">
            {currentStory.caption}
          </div>
        )}

        {/* Bottom Reaction & Reply Bar */}
        <div className="relative z-20 p-4 space-y-2.5 pointer-events-auto">
          <div className="flex items-center justify-center gap-2">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleQuickReaction(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm hover:scale-115 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendReply();
              }}
              placeholder={`Reply to ${currentGroup.displayName}...`}
              className="h-9 rounded-lg bg-black/60 border-white/20 text-white placeholder:text-white/50 text-xs focus-visible:ring-primary"
            />

            <button
              type="button"
              onClick={handleSendReply}
              disabled={!replyText.trim()}
              className="rounded-lg bg-[#E91E63] hover:bg-[#C2185B] p-2 text-white disabled:opacity-40 transition-colors"
              aria-label="Send reply"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatStoryTime(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSec < 60) return "just now";

  const diffMin = Math.floor(diffSec / 60);

  if (diffMin < 60) return `${diffMin}m`;

  const diffHours = Math.floor(diffMin / 60);

  if (diffHours < 24) return `${diffHours}h`;

  return "yesterday";
}
