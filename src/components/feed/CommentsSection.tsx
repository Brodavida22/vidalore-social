import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, Reply, Trash2, Send, CornerDownRight, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/profile/UserAvatar";
import type { Profile } from "@/services/profiles";
import {
  getStoredComments,
  addComment,
  toggleCommentReaction,
  deleteComment,
  type PostComment,
} from "@/services/social";

const EMOJI_SHORTCUTS = ["🌹", "💖", "✨", "🍷", "🖤", "🔥", "👏", "🥀"];

export function CommentsSection({
  postId,
  me,
  onCommentChange,
}: {
  postId: string;
  me?: Profile | null;
  onCommentChange?: () => void;
}) {
  const [comments, setComments] = useState<PostComment[]>(() =>
    getStoredComments().filter((c) => c.postId === postId),
  );
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<PostComment | null>(null);

  const parentComments = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => !!c.parentId);

  function handleSend() {
    if (!inputText.trim()) return;
    if (!me) {
      toast.error("Please sign in to leave a comment.");
      return;
    }
    const newComment = addComment(me, postId, inputText.trim(), replyingTo ? replyingTo.id : null);
    setComments((prev) => [...prev, newComment]);
    setInputText("");
    setReplyingTo(null);
    toast.success("Comment added 🌹");
    onCommentChange?.();
  }

  function handleReaction(commentId: string) {
    const updated = toggleCommentReaction(commentId);
    if (updated) {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c)));
    }
  }

  function handleDelete(commentId: string) {
    deleteComment(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
    toast.info("Comment removed");
    onCommentChange?.();
  }

  function insertEmoji(emoji: string) {
    setInputText((prev) => prev + emoji);
  }

  return (
    <div className="space-y-4 pt-3">
      {/* Existing Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {parentComments.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No thoughts shared yet. Be the first to leave a petal 🌹
          </p>
        ) : (
          parentComments.map((parent) => {
            const childReplies = replies.filter((r) => r.parentId === parent.id);
            const isMyParent = Boolean(me && parent.authorId === me.id);
            return (
              <div key={parent.id} className="space-y-2 group">
                <div className="flex items-start gap-2.5">
                  <Link
                    to="/u/$username"
                    params={{ username: parent.authorUsername }}
                    className="shrink-0"
                  >
                    <UserAvatar
                      profile={{
                        avatar_url: parent.authorAvatarUrl,
                        username: parent.authorUsername,
                        display_name: parent.authorName,
                      }}
                      className="h-8 w-8 text-xs ring-1 ring-primary/30"
                    />
                  </Link>

                  <div className="flex-1 min-w-0 rounded-2xl bg-secondary/50 px-3.5 py-2">
                    <div className="flex items-center justify-between">
                      <Link
                        to="/u/$username"
                        params={{ username: parent.authorUsername }}
                        className="text-xs font-semibold hover:text-rose-soft"
                      >
                        {parent.authorName}
                      </Link>
                      <span className="text-[0.65rem] text-muted-foreground">
                        {new Date(parent.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {parent.content}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[0.7rem] text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => handleReaction(parent.id)}
                        className={`flex items-center gap-1 hover:text-primary transition-colors ${
                          parent.hasReacted ? "text-primary font-semibold" : ""
                        }`}
                      >
                        <Heart className={`h-3 w-3 ${parent.hasReacted ? "fill-primary" : ""}`} />
                        {parent.reactionsCount > 0 && parent.reactionsCount}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(parent);
                          setInputText(`@${parent.authorUsername} `);
                        }}
                        className="hover:text-rose-soft transition-colors flex items-center gap-1"
                      >
                        <Reply className="h-3 w-3" /> Reply
                      </button>

                      {isMyParent && (
                        <button
                          type="button"
                          onClick={() => handleDelete(parent.id)}
                          className="hover:text-destructive transition-colors ml-auto opacity-0 group-hover:opacity-100"
                          title="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nested 1-level replies */}
                {childReplies.length > 0 && (
                  <div className="ml-8 space-y-2 pl-3 border-l-2 border-border/70">
                    {childReplies.map((reply) => {
                      const isMyReply = Boolean(me && reply.authorId === me.id);
                      return (
                        <div key={reply.id} className="flex items-start gap-2 group/rep">
                          <Link
                            to="/u/$username"
                            params={{ username: reply.authorUsername }}
                            className="shrink-0"
                          >
                            <UserAvatar
                              profile={{
                                avatar_url: reply.authorAvatarUrl,
                                username: reply.authorUsername,
                                display_name: reply.authorName,
                              }}
                              className="h-6 w-6 text-[0.65rem]"
                            />
                          </Link>
                          <div className="flex-1 min-w-0 rounded-2xl bg-secondary/30 px-3 py-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-rose-soft">
                                {reply.authorName}
                              </span>
                              <span className="text-[0.65rem] text-muted-foreground">
                                {new Date(reply.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-foreground/90 leading-relaxed">
                              {reply.content}
                            </p>
                            <div className="mt-1 flex items-center gap-3 text-[0.65rem] text-muted-foreground">
                              <button
                                type="button"
                                onClick={() => handleReaction(reply.id)}
                                className={`flex items-center gap-1 hover:text-primary ${
                                  reply.hasReacted ? "text-primary font-semibold" : ""
                                }`}
                              >
                                <Heart
                                  className={`h-2.5 w-2.5 ${reply.hasReacted ? "fill-primary" : ""}`}
                                />
                                {reply.reactionsCount > 0 && reply.reactionsCount}
                              </button>
                              {isMyReply && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(reply.id)}
                                  className="hover:text-destructive ml-auto opacity-0 group-hover/rep:opacity-100"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Replying indicator */}
      {replyingTo && (
        <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-1.5 text-xs text-rose-soft">
          <span className="flex items-center gap-1.5">
            <CornerDownRight className="h-3.5 w-3.5" />
            Replying to @{replyingTo.authorUsername}
          </span>
          <button
            type="button"
            onClick={() => {
              setReplyingTo(null);
              setInputText("");
            }}
            className="hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Emoji fast picker */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        {EMOJI_SHORTCUTS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => insertEmoji(emoji)}
            className="rounded-full bg-secondary/40 px-2 py-0.5 text-xs hover:bg-secondary hover:scale-110 transition-all shrink-0"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Comment Input */}
      <div className="flex items-center gap-2">
        <UserAvatar
          profile={
            me || {
              username: "member",
              display_name: "You",
              avatar_url: null,
            }
          }
          className="h-8 w-8 text-xs shrink-0 ring-1 ring-primary/40"
        />
        <div className="relative flex-1">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              replyingTo
                ? `Reply to @${replyingTo.authorUsername}...`
                : "Leave a thought in the garden... 🌹"
            }
            className="h-10 rounded-full bg-secondary/60 pr-10 text-xs focus-visible:ring-primary"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-primary disabled:opacity-40 hover:scale-110 transition-all"
            aria-label="Send comment"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
