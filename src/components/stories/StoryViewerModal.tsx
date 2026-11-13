import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { Link } from "@tanstack/react-router";
import { QueryClientContext } from "@tanstack/react-query";
import { X, Send, Loader2, AlertCircle, Volume2, VolumeX, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Input } from "@/components/ui/input";
import { useVideoAudioPreference } from "@/lib/videoAudioPreference";
import { useAndroidBackNavigation } from "@/lib/useAndroidBackNavigation";
import { sendStoryReplyDM } from "@/services/messages";
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
import {
  deleteStory,
  markStorySeen,
  type UserStoryGroup,
  type StoryItem,
} from "@/services/reelsAndStories";
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
  const queryClient = useContext(QueryClientContext);
  useAndroidBackNavigation(open, onClose, "storyViewer");
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isReplyInputFocused, setIsReplyInputFocused] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isPaused =
    isHolding || isReplyInputFocused || isSendingReply || confirmDeleteOpen || deleting;
  const [replyText, setReplyText] = useState("");
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  // Audio preference state: remembered across stories and videos
  const { preferredMuted: isMuted, setPreferredMuted: setIsMuted } = useVideoAudioPreference();
  const [isAutoplaySoundBlocked, setIsAutoplaySoundBlocked] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(0);

  const currentGroup = storyGroups[groupIndex];
  const currentStory: StoryItem | undefined = currentGroup?.stories[storyIndex];

  // Pause / resume video when user presses and holds
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPaused) {
      video.pause();
    } else if (video.paused && !videoLoading && !videoError) {
      video.play().catch(() => {});
    }
  }, [isPaused, videoLoading, videoError]);

  // Synchronize muted attribute whenever isMuted changes
  useEffect(() => {
    const video = videoRef.current;
    if (video && !isAutoplaySoundBlocked) {
      video.muted = isMuted;
    }
  }, [isMuted, isAutoplaySoundBlocked]);

  useEffect(() => {
    setGroupIndex(initialGroupIndex);
    setStoryIndex(0);
    progressRef.current = 0;
    setProgress(0);
    setVideoLoading(true);
    setVideoError(false);
    setIsAutoplaySoundBlocked(false);
  }, [initialGroupIndex, open]);

  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
    setVideoLoading(currentStory?.mediaType === "video");
    setVideoError(false);
    setIsAutoplaySoundBlocked(false);
  }, [currentStory?.id, currentStory?.mediaType]);

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
      progressRef.current = 0;
      setProgress(0);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      progressRef.current = 0;
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentGroup, storyIndex, groupIndex, storyGroups.length, onClose]);

  const handlePrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      progressRef.current = 0;
      setProgress(0);
    } else if (groupIndex > 0) {
      const prevGroup = storyGroups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(prevGroup ? prevGroup.stories.length - 1 : 0);
      progressRef.current = 0;
      setProgress(0);
    }
  }, [storyIndex, groupIndex, storyGroups]);

  // Autoplay handler with audio policy recovery
  const attemptVideoPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !currentStory || currentStory.mediaType !== "video") return;

    video.muted = isMuted;
    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setVideoLoading(false);
          setVideoError(false);
          setIsAutoplaySoundBlocked(false);
        })
        .catch((err) => {
          console.warn("Video playback attempt:", err);
          // If browser policy blocked unmuted autoplay, play muted & show tap-for-sound banner
          if (!video.muted) {
            video.muted = true;
            setIsAutoplaySoundBlocked(true);
            video
              .play()
              .then(() => {
                setVideoLoading(false);
                setVideoError(false);
              })
              .catch(() => {
                setVideoLoading(false);
                setVideoError(true);
              });
          } else {
            setVideoLoading(false);
            setVideoError(true);
          }
        });
    }
  }, [currentStory, isMuted]);

  function handleEnableSound(e: React.MouseEvent) {
    e.stopPropagation();
    setIsMuted(false);
    setIsAutoplaySoundBlocked(false);
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.play().catch(() => {});
    }
    toast.success("Sound enabled 🔊");
  }

  function handleToggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    if (isAutoplaySoundBlocked) {
      setIsAutoplaySoundBlocked(false);
      setIsMuted(false);
      const video = videoRef.current;
      if (video) {
        video.muted = false;
        video.play().catch(() => {});
      }
      return;
    }
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    const video = videoRef.current;
    if (video) {
      video.muted = nextMuted;
    }
  }

  // Images advance after five seconds.
  // Videos advance only when playback finishes.
  useEffect(() => {
    if (!open || isPaused || !currentStory || currentStory.mediaType === "video") {
      return;
    }

    const interval = 50;
    const step = (interval / STORY_DURATION_MS) * 100;

    const timer = setInterval(() => {
      const next = progressRef.current + step;

      if (next >= 100) {
        clearInterval(timer);
        progressRef.current = 100;
        setProgress(100);
        handleNext();
        return;
      }

      progressRef.current = next;
      setProgress(next);
    }, interval);

    return () => clearInterval(timer);
  }, [open, isPaused, currentStory?.id, currentStory?.mediaType, handleNext]);

  async function submitStoryReply(rawText: string) {
    const clean = rawText.trim();
    if (!clean || !currentStory || !currentGroup || isSendingReply) return;

    setIsSendingReply(true);
    try {
      const { conversation } = await sendStoryReplyDM({
        storyId: currentStory.id,
        ownerId: currentStory.userId,
        ownerUsername: currentGroup.username,
        mediaType: currentStory.mediaType,
        mediaPath: currentStory.mediaPath,
        caption: currentStory.caption,
        expiresAt: currentStory.expiresAt,
        replyText: clean,
      });

      if (queryClient) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] }),
          queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] }),
        ]);
      }

      setReplyText("");
      toast.success(`Reply sent to @${currentGroup.username}'s messages`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send story reply.");
    } finally {
      setIsSendingReply(false);
    }
  }

  function handleSendReply() {
    void submitStoryReply(replyText);
  }

  function handleQuickReaction(emoji: string) {
    void submitStoryReply(emoji);
  }

  async function handleDeleteStory() {
    if (!currentStory || deleting) return;
    setDeleting(true);
    try {
      await deleteStory(currentStory.id);
      toast.success("Story deleted");
      setConfirmDeleteOpen(false);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete story.");
    } finally {
      setDeleting(false);
    }
  }

  if (!open || !currentGroup || !currentStory) return null;

  const isOwnStory = !!me && currentStory.userId === me.id;

  const timeAgo = formatStoryTime(new Date(currentStory.createdAt));

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none animate-fade-in"
      onMouseDown={() => setIsHolding(true)}
      onMouseUp={() => setIsHolding(false)}
      onTouchStart={() => setIsHolding(true)}
      onTouchEnd={() => setIsHolding(false)}
    >
      <div className="relative h-full w-full max-w-sm sm:max-h-[92vh] sm:rounded-2xl overflow-hidden bg-black flex flex-col justify-between shadow-2xl border border-white/10">
        {/* Media Background */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
          {currentStory.mediaType === "video" ? (
            <>
              <video
                ref={videoRef}
                key={currentStory.id}
                src={currentStory.mediaUrl}
                autoPlay
                playsInline
                preload="auto"
                controls={false}
                className="h-full w-full object-contain"
                onLoadStart={() => {
                  setVideoLoading(true);
                  setVideoError(false);
                }}
                onCanPlay={() => {
                  attemptVideoPlay();
                }}
                onPlaying={() => {
                  setVideoLoading(false);
                  setVideoError(false);
                }}
                onWaiting={() => setVideoLoading(true)}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration > 0) {
                    const pct = Math.min(100, (v.currentTime / v.duration) * 100);
                    progressRef.current = pct;
                    setProgress(pct);
                  }
                }}
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
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black text-white p-4">
                  <AlertCircle className="h-10 w-10 text-red-400" />
                  <p className="text-sm font-semibold">Video could not be played</p>
                  <p className="max-w-[240px] text-center text-xs text-white/60">
                    Check your internet connection or reload the story.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoError(false);
                      setVideoLoading(true);
                      const video = videoRef.current;
                      if (video) {
                        video.load();
                        attemptVideoPlay();
                      }
                    }}
                    className="rounded-lg bg-[#E91E63] px-4 py-2 text-xs font-semibold text-white shadow"
                  >
                    Retry video
                  </button>
                </div>
              )}

              {/* Tap to enable sound banner if browser blocked audio autoplay */}
              {isAutoplaySoundBlocked && !videoError && (
                <button
                  type="button"
                  onClick={handleEnableSound}
                  className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/75 text-white backdrop-blur-md text-xs font-semibold shadow-xl border border-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer pointer-events-auto animate-bounce"
                >
                  <VolumeX className="h-3.5 w-3.5 text-[#E91E63]" />
                  <span>Tap for sound 🔊</span>
                </button>
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
        <div className="relative z-20 px-4 pt-[max(env(safe-area-inset-top),0.875rem)] pb-3 space-y-3 pointer-events-auto">
          <div className="flex gap-1 items-center">
            {currentGroup.stories.map((s, idx) => {
              const isPast = idx < storyIndex;
              const isCurrent = idx === storyIndex;

              return (
                <div key={s.id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-75"
                    style={{
                      width: isPast ? "100%" : isCurrent ? `${progress}%` : "0%",
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

            <div className="flex items-center gap-1.5">
              {/* Sound toggle button for video stories (always visible & honest about blocked audio) */}
              {currentStory.mediaType === "video" && (
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 border border-white/15 text-white hover:bg-black/80 active:scale-95 transition-all"
                  aria-label={isMuted || isAutoplaySoundBlocked ? "Unmute video" : "Mute video"}
                  title={isMuted || isAutoplaySoundBlocked ? "Unmute" : "Mute"}
                >
                  {isMuted || isAutoplaySoundBlocked ? (
                    <VolumeX className="h-4 w-4 text-white/90" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-[#E91E63]" />
                  )}
                </button>
              )}

              {isOwnStory && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteOpen(true);
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 active:scale-95 transition-all"
                  aria-label="Delete story"
                  title="Delete story"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 active:scale-95 transition-all"
                aria-label="Close stories"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Story Caption */}
        {currentStory.caption && (
          <div className="relative z-20 mx-4 my-auto p-3 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs text-center font-medium border border-white/10 pointer-events-none">
            {currentStory.caption}
          </div>
        )}

        {/* Bottom Reaction & Reply Bar (hidden on user's own story) */}
        <div
          className="relative z-20 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] space-y-2.5 pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {isOwnStory ? (
            <p className="text-center text-[11px] text-white/65 py-1">
              Viewing your own story · {currentStory.seenBy.length} view
              {currentStory.seenBy.length === 1 ? "" : "s"}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    disabled={isSendingReply}
                    onClick={() => handleQuickReaction(emoji)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm hover:scale-115 transition-transform disabled:opacity-50"
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setIsReplyInputFocused(true)}
                  onBlur={() => setIsReplyInputFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  disabled={isSendingReply}
                  placeholder={`Reply to ${currentGroup.displayName}...`}
                  className="h-9 rounded-lg bg-black/60 border-white/20 text-white placeholder:text-white/50 text-xs focus-visible:ring-primary"
                />

                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSendingReply}
                  className="rounded-lg bg-[#E91E63] hover:bg-[#C2185B] p-2 text-white disabled:opacity-40 transition-colors"
                  aria-label="Send reply"
                >
                  {isSendingReply ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(next) => {
          if (!deleting) setConfirmDeleteOpen(next);
        }}
      >
        <AlertDialogContent
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed for everyone right away. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteStory();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
