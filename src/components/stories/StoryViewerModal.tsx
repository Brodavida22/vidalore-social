import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { X, Send, Heart, Sparkles, Flame, ThumbsUp, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Input } from "@/components/ui/input";
import { markStorySeen, type UserStoryGroup, type StoryItem } from "@/services/reelsAndStories";
import type { Profile } from "@/services/profiles";

const STORY_DURATION_MS = 5000;
const QUICK_REACTIONS = ["🌹", "❤️", "🔥", "✨", "👏", "🍷"];

export function StoryViewerModal({
  storyGroups,
  initialGroupIndex = 0,
  open,
  onClose,
  me,
}: {
  storyGroups: UserStoryGroup[];
  initialGroupIndex?: number;
  open: boolean;
  onClose: () => void;
  me?: Profile | null;
}) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState("");

  const currentGroup = storyGroups[groupIndex];
  const currentStory: StoryItem | undefined = currentGroup?.stories[storyIndex];

  // Reset when groupIndex changes
  useEffect(() => {
    setGroupIndex(initialGroupIndex);
    setStoryIndex(0);
    setProgress(0);
  }, [initialGroupIndex, open]);

  // Mark current story as seen
  useEffect(() => {
    if (currentStory && me) {
      markStorySeen(currentStory.id, me.id);
    }
  }, [currentStory, me]);

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

  // Timer loop for active story progress
  useEffect(() => {
    if (!open || isPaused || !currentStory) return;

    const interval = 50; // ms
    const step = (interval / STORY_DURATION_MS) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [open, isPaused, currentStory, handleNext]);

  function handleSendReply() {
    if (!replyText.trim()) return;
    toast.success(`Reply sent to @${currentGroup?.username} 🌹`);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-fade-in"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="relative h-full w-full max-w-sm sm:max-h-[92vh] sm:rounded-3xl overflow-hidden bg-black flex flex-col justify-between shadow-2xl border border-border/40">
        {/* Media Background */}
        <div className="absolute inset-0 z-0">
          {currentStory.mediaType === "video" ? (
            <video
              src={currentStory.mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img src={currentStory.mediaUrl} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80 pointer-events-none" />
        </div>

        {/* Tap navigation zones: left 40% prev, right 60% next */}
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

        {/* Top Header & Segmented Progress Bar */}
        <div className="relative z-20 p-4 space-y-3 pointer-events-auto">
          {/* Progress Bars */}
          <div className="flex gap-1.5 items-center">
            {currentGroup.stories.map((s, idx) => {
              const isPast = idx < storyIndex;
              const isCurrent = idx === storyIndex;
              return (
                <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-rose transition-all duration-75"
                    style={{
                      width: isPast ? "100%" : isCurrent ? `${progress}%` : "0%",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* User info & Close */}
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
                className="h-9 w-9 text-xs ring-2 ring-primary"
              />
              <div>
                <p className="text-xs font-bold text-white group-hover:text-rose-soft transition-colors truncate max-w-[140px]">
                  {currentGroup.displayName}
                </p>
                <p className="text-[0.65rem] text-white/80">
                  @{currentGroup.username} · {timeAgo}
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/40 p-2 text-white hover:bg-black/60 transition-colors"
              aria-label="Close stories"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Story Caption / Sticker Center */}
        {currentStory.caption && (
          <div className="relative z-20 mx-4 my-auto p-3.5 rounded-2xl bg-black/50 backdrop-blur-md text-white text-sm text-center drop-shadow-md border border-white/10 pointer-events-none">
            {currentStory.caption}
          </div>
        )}

        {/* Bottom Reaction & Reply Bar */}
        <div className="relative z-20 p-4 space-y-3 pointer-events-auto">
          {/* Fast Emoji Reactions */}
          <div className="flex items-center justify-center gap-3">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleQuickReaction(emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-lg hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Reply Input */}
          <div className="flex items-center gap-2">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendReply();
              }}
              placeholder={`Reply to ${currentGroup.displayName}...`}
              className="h-10 rounded-full bg-black/60 border-white/20 text-white placeholder:text-white/60 text-xs focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={handleSendReply}
              disabled={!replyText.trim()}
              className="rounded-full bg-gradient-rose p-2.5 text-white disabled:opacity-40 shadow-glow"
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
