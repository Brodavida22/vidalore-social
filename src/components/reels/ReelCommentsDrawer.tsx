import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, Send, MessageSquare, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/profile/UserAvatar";
import type { Profile } from "@/services/profiles";
import {
  getReelComments,
  addReelComment,
  deleteReelComment,
  toggleCommentReaction,
  subscribeToReelEngagement,
  type ReelComment,
} from "@/services/reelsAndStories";

const EMOJIS = ["🌹", "🔥", "✨", "💖", "👏", "🍷", "🖤"];

export function ReelCommentsDrawer({
  reelId,
  open,
  onOpenChange,
  me,
  onCommentAdded,
  onCommentDeleted,
}: {
  reelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me?: Profile | null | undefined;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
}) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [text, setText] = useState("");

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getReelComments(reelId);
      setComments(Array.isArray(data) ? data : []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not load comments.";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [reelId]);

  useEffect(() => {
    if (!open) return;
    void loadComments();
    const unsubscribe = subscribeToReelEngagement(reelId, {
      onCommentInserted: () => {
        void loadComments();
      },
      onCommentDeleted: () => {
        void loadComments();
      },
    });
    return () => {
      unsubscribe();
    };
  }, [open, reelId, loadComments]);

  async function handleDeleteComment(commentId: string) {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await deleteReelComment(commentId, reelId);
      toast.success("Comment deleted");
      onCommentDeleted?.();
    } catch (error) {
      setComments(previous);
      toast.error(error instanceof Error ? error.message : "Could not delete comment.");
    }
  }

  async function handleSend() {
    const clean = text.trim();
    if (!clean) return;
    if (!me) {
      toast.error("Please sign in to comment on reels.");
      return;
    }

    // Temporary optimistic comment
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: ReelComment = {
      id: tempId,
      reelId,
      authorId: me.id,
      authorName: me.display_name || me.username || "You",
      authorUsername: me.username || "you",
      authorAvatarUrl: me.avatar_url,
      content: clean,
      createdAt: new Date().toISOString(),
      reactionsCount: 0,
      hasReacted: false,
    };

    setComments((prev) => [...prev, optimisticComment]);
    setText("");
    setIsSubmitting(true);

    try {
      const newComment = await addReelComment(me, reelId, clean);
      // Replace optimistic comment with confirmed one from server
      setComments((prev) => prev.map((c) => (c.id === tempId ? newComment : c)));
      toast.success("Comment added 🌹");
      onCommentAdded?.();
    } catch (error) {
      // Rollback optimistic comment on failure
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setText(clean);
      toast.error(error instanceof Error ? error.message : "Could not add comment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLike(commentId: string) {
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;

    const prevReacted = target.hasReacted ?? false;
    const prevCount = target.reactionsCount;
    const nextReacted = !prevReacted;
    const nextCount = Math.max(0, prevCount + (nextReacted ? 1 : -1));

    // Optimistic reaction update
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              hasReacted: nextReacted,
              reactionsCount: nextCount,
            }
          : c,
      ),
    );

    try {
      const confirmed = await toggleCommentReaction(commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                hasReacted: confirmed,
              }
            : c,
        ),
      );
    } catch (error) {
      // Rollback
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                hasReacted: prevReacted,
                reactionsCount: prevCount,
              }
            : c,
        ),
      );
      toast.error(error instanceof Error ? error.message : "Could not react to comment.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-border bg-card p-4 max-h-[80vh] flex flex-col rounded-2xl shadow-xl">
        <DialogHeader className="border-b border-border pb-3 flex flex-row items-center justify-between">
          <DialogTitle className="font-display text-lg flex items-center gap-2 text-foreground">
            <MessageSquare className="h-4 w-4 text-[#E91E63]" />
            Comments
            {!isLoading && (
              <span className="text-xs text-muted-foreground font-sans font-normal">
                ({comments.length})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-[160px]">
          {isLoading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-[#E91E63]" />
              <span>Loading comments...</span>
            </div>
          ) : loadError ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-xs text-destructive">{loadError}</p>
              <button
                type="button"
                onClick={loadComments}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium hover:bg-secondary/80 transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> Retry
              </button>
            </div>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center space-y-1">
              <MessageSquare className="h-8 w-8 text-muted-foreground/60 mx-auto" />
              <p className="font-semibold text-xs text-foreground">No comments yet</p>
              <p className="text-[0.7rem] text-muted-foreground">
                Be the first to share your thoughts on this reel.
              </p>
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <Link to="/u/$username" params={{ username: c.authorUsername }}>
                  <UserAvatar
                    profile={{
                      avatar_url: c.authorAvatarUrl,
                      username: c.authorUsername,
                      display_name: c.authorName,
                    }}
                    className="h-8 w-8 text-xs shrink-0 ring-1 ring-border"
                  />
                </Link>

                <div className="flex-1 min-w-0 rounded-xl bg-secondary/50 p-2.5 border border-border/50">
                  <div className="flex items-center justify-between">
                    <Link
                      to="/u/$username"
                      params={{ username: c.authorUsername }}
                      className="text-xs font-semibold text-foreground hover:text-[#E91E63] transition-colors"
                    >
                      {c.authorName}
                    </Link>
                    <span className="text-[0.65rem] text-muted-foreground">
                      {new Date(c.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                    {c.content}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.65rem] text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => handleLike(c.id)}
                      className={`flex items-center gap-1 hover:text-[#E91E63] transition-colors ${
                        c.hasReacted ? "text-[#E91E63] font-semibold" : ""
                      }`}
                    >
                      <Heart
                        className={`h-2.5 w-2.5 ${c.hasReacted ? "fill-[#E91E63] text-[#E91E63]" : ""}`}
                      />
                      {c.reactionsCount > 0 && <span>{c.reactionsCount}</span>}
                    </button>

                    {me?.id === c.authorId && !c.id.startsWith("temp-") && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteComment(c.id)}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Emoji Bar */}
        <div className="flex items-center gap-1.5 px-1 py-1 border-t border-border/50 overflow-x-auto">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setText((prev) => prev + emoji)}
              className="text-sm p-1 rounded hover:bg-secondary transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <UserAvatar
            profile={me || { username: "member", display_name: "You", avatar_url: null }}
            className="h-8 w-8 text-xs shrink-0 ring-1 ring-border"
          />
          <div className="relative flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Add a comment..."
              disabled={isSubmitting}
              className="h-9 rounded-xl bg-secondary/60 pr-9 text-xs border-border focus-visible:ring-[#E91E63]"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim() || isSubmitting}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#E91E63] disabled:opacity-40 hover:text-[#C2185B] transition-colors"
              aria-label="Send"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
