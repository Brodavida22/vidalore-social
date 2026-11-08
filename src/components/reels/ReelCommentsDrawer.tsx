import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, Send, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/profile/UserAvatar";
import type { Profile } from "@/services/profiles";
import {
  getReelComments,
  addReelComment,
  toggleCommentReaction,
  type ReelComment,
} from "@/services/reelsAndStories";

const EMOJIS = ["🌹", "🔥", "✨", "💖", "👏", "🍷", "🖤"];

export function ReelCommentsDrawer({
  reelId,
  open,
  onOpenChange,
  me,
  onCommentAdded,
}: {
  reelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me?: Profile | null;
  onCommentAdded?: () => void;
}) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  useEffect(() => {
    if (!open) return;
    void getReelComments(reelId)
      .then(setComments)
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Could not load comments."),
      );
  }, [open, reelId]);
  const [text, setText] = useState("");

  async function handleSend() {
    if (!text.trim()) return;
    if (!me) {
      toast.error("Please sign in to comment on reels.");
      return;
    }

    try {
      const newComment = await addReelComment(me, reelId, text.trim());
      setComments((prev) => [...prev, newComment]);
      setText("");
      toast.success("Comment added 🌹");
      onCommentAdded?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add comment.");
    }
  }

  async function handleLike(commentId: string) {
    try {
      const hasReacted = await toggleCommentReaction(commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                hasReacted,
                reactionsCount: Math.max(0, c.reactionsCount + (hasReacted ? 1 : -1)),
              }
            : c,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not react to comment.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass border-border/80 p-4 max-h-[80vh] flex flex-col">
        <DialogHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Comments
            <span className="text-xs text-muted-foreground font-sans font-normal">
              ({comments.length})
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {comments.length === 0 ? (
            <div className="py-12 text-center space-y-1">
              <span className="text-3xl">🌹</span>
              <p className="font-semibold text-xs text-foreground">No comments yet</p>
              <p className="text-[0.7rem] text-muted-foreground">
                Be the first to leave a thought on this reel.
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
                    className="h-8 w-8 text-xs shrink-0 ring-1 ring-primary/30"
                  />
                </Link>

                <div className="flex-1 min-w-0 rounded-2xl bg-secondary/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <Link
                      to="/u/$username"
                      params={{ username: c.authorUsername }}
                      className="text-xs font-semibold hover:text-rose-soft"
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
                  <p className="mt-1 text-xs text-foreground/90 leading-relaxed">{c.content}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => handleLike(c.id)}
                      className={`flex items-center gap-1 hover:text-primary ${
                        c.hasReacted ? "text-primary font-semibold" : ""
                      }`}
                    >
                      <Heart className={`h-2.5 w-2.5 ${c.hasReacted ? "fill-primary" : ""}`} />
                      {c.reactionsCount > 0 && c.reactionsCount}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Emojis bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setText((t) => t + emoji)}
              className="rounded-full bg-secondary/50 px-2 py-0.5 text-xs hover:scale-110 transition-transform shrink-0"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/60">
          <UserAvatar
            profile={me || { username: "member", display_name: "You", avatar_url: null }}
            className="h-8 w-8 text-xs shrink-0 ring-1 ring-primary/40"
          />
          <div className="relative flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Add a comment... 🌹"
              className="h-9 rounded-full bg-secondary/60 pr-9 text-xs"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary disabled:opacity-40 hover:scale-110 transition-transform"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
