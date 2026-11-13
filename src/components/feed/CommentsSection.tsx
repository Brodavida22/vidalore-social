import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Reply, Trash2, Send, CornerDownRight, X, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/profile/UserAvatar";
import type { Profile } from "@/services/profiles";
import {
  commentsQuery,
  addComment,
  deleteComment,
  setCommentLiked,
  postsKeys,
  type PostComment,
} from "@/services/posts";

const EMOJI_SHORTCUTS = ["👍", "❤️", "🔥", "👏", "💡", "🙌", "✨", "🎯"];

export function CommentsSection({
  postId,
  me,
  onCommentChange,
}: {
  postId: string;
  me?: Profile | null | undefined;
  onCommentChange?: (delta: number) => void;
}) {
  const queryClient = useQueryClient();
  const { data: comments = [], isLoading } = useQuery(commentsQuery(postId));
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<PostComment | null>(null);
  const [isSending, setIsSending] = useState(false);

  const parentComments = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => !!c.parentId);

  async function handleSend() {
    if (!inputText.trim()) return;
    if (!me) {
      toast.error("Please sign in to leave a comment.");
      return;
    }

    setIsSending(true);
    try {
      await addComment(postId, inputText.trim(), replyingTo ? replyingTo.id : null);
      setInputText("");
      setReplyingTo(null);
      toast.success(replyingTo ? "Reply posted" : "Comment added");
      await queryClient.invalidateQueries({ queryKey: postsKeys.comments(postId) });
      await queryClient.invalidateQueries({ queryKey: postsKeys.all });
      onCommentChange?.(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add comment.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleReaction(comment: PostComment) {
    if (!me) {
      toast.error("Please sign in to like comments.");
      return;
    }
    const nextReacted = !comment.hasReacted;
    try {
      await setCommentLiked(comment.id, nextReacted);
      await queryClient.invalidateQueries({ queryKey: postsKeys.comments(postId) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update reaction.");
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment(commentId);
      toast.info("Comment removed");
      await queryClient.invalidateQueries({ queryKey: postsKeys.comments(postId) });
      await queryClient.invalidateQueries({ queryKey: postsKeys.all });
      onCommentChange?.(-1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete comment.");
    }
  }

  function insertEmoji(emoji: string) {
    setInputText((prev) => prev + emoji);
  }

  return (
    <div className="space-y-4 pt-3 border-t border-border mt-3">
      {/* Existing Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-[#E91E63]" />
            <span>Loading comments...</span>
          </div>
        ) : parentComments.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No comments yet. Be the first to start the conversation.
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
                      className="h-8 w-8 text-xs ring-1 ring-border"
                    />
                  </Link>

                  <div className="flex-1 min-w-0 rounded-xl bg-secondary/70 px-3.5 py-2 border border-border/50">
                    <div className="flex items-center justify-between">
                      <Link
                        to="/u/$username"
                        params={{ username: parent.authorUsername }}
                        className="text-xs font-semibold hover:text-[#E91E63] transition-colors"
                      >
                        {parent.authorName}
                      </Link>
                      <span className="text-[0.65rem] text-muted-foreground">
                        {new Date(parent.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {parent.isEdited && " · edited"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {parent.content}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[0.7rem] text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => handleReaction(parent)}
                        className={`flex items-center gap-1 hover:text-[#E91E63] transition-colors ${
                          parent.hasReacted ? "text-[#E91E63] font-semibold" : ""
                        }`}
                      >
                        <Heart
                          className={`h-3 w-3 ${
                            parent.hasReacted ? "fill-[#E91E63] text-[#E91E63]" : ""
                          }`}
                        />
                        {parent.reactionsCount > 0 && parent.reactionsCount}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(parent);
                          setInputText(`@${parent.authorUsername} `);
                        }}
                        className="hover:text-[#E91E63] transition-colors flex items-center gap-1"
                      >
                        <Reply className="h-3 w-3" /> Reply
                      </button>

                      {isMyParent && (
                        <button
                          type="button"
                          onClick={() => handleDelete(parent.id)}
                          className="hover:text-destructive transition-colors ml-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 min-h-[28px] px-1"
                          title="Delete comment"
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nested replies */}
                {childReplies.length > 0 && (
                  <div className="ml-8 space-y-2 pl-3 border-l-2 border-border">
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
                          <div className="flex-1 min-w-0 rounded-xl bg-secondary/40 px-3 py-1.5 border border-border/40">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">
                                {reply.authorName}
                              </span>
                              <span className="text-[0.65rem] text-muted-foreground">
                                {new Date(reply.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {reply.isEdited && " · edited"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-foreground leading-relaxed">
                              {reply.content}
                            </p>
                            <div className="mt-1 flex items-center gap-3 text-[0.65rem] text-muted-foreground">
                              <button
                                type="button"
                                onClick={() => handleReaction(reply)}
                                className={`flex items-center gap-1 hover:text-[#E91E63] ${
                                  reply.hasReacted ? "text-[#E91E63] font-semibold" : ""
                                }`}
                              >
                                <Heart
                                  className={`h-2.5 w-2.5 ${
                                    reply.hasReacted ? "fill-[#E91E63] text-[#E91E63]" : ""
                                  }`}
                                />
                                {reply.reactionsCount > 0 && reply.reactionsCount}
                              </button>
                              {isMyReply && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(reply.id)}
                                  className="hover:text-destructive ml-auto opacity-100 md:opacity-0 md:group-hover/rep:opacity-100 min-h-[28px] px-1"
                                  title="Delete reply"
                                  aria-label="Delete reply"
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
        <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-1.5 text-xs text-[#E91E63] font-medium">
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
            className="hover:text-foreground text-muted-foreground"
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
            className="rounded-lg bg-secondary px-2 py-0.5 text-xs hover:bg-secondary/80 hover:scale-105 transition-all shrink-0"
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
          className="h-8 w-8 text-xs shrink-0 ring-1 ring-border"
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
              replyingTo ? `Reply to @${replyingTo.authorUsername}...` : "Write a comment..."
            }
            className="h-9 rounded-lg bg-secondary pr-10 text-xs border-border focus-visible:ring-primary"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() || isSending}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#E91E63] disabled:opacity-40 hover:text-[#C2185B] transition-colors"
            aria-label="Send comment"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
