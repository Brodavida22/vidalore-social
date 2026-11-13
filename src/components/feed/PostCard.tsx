import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  MessageCircle,
  Repeat,
  Bookmark,
  MoreHorizontal,
  Share2,
  Flag,
  Trash2,
  MapPin,
  Volume2,
  VolumeX,
  Play,
  Pause,
  UserX,
  Copy,
  BadgeCheck,
  AlertCircle,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useAndroidBackNavigation } from "@/lib/useAndroidBackNavigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { CommentsSection } from "@/components/feed/CommentsSection";
import { ShareModal } from "@/components/feed/ShareModal";
import { ReportModal } from "@/components/feed/ReportModal";
import { PostVideoPlayer } from "@/components/feed/PostVideoPlayer";
import type { Profile } from "@/services/profiles";
import {
  type SocialPost,
  type PostMedia,
  setPostLiked,
  setPostSaved,
  deletePost,
  postsKeys,
} from "@/services/posts";
import { blockUser } from "@/services/blocks";

export function PostCard({
  post: initialPost,
  me,
  onDeleted,
  onPostUpdated,
}: {
  post: SocialPost;
  me?: Profile | null | undefined;
  onDeleted?: (id: string) => void;
  onPostUpdated?: (updated: SocialPost) => void;
}) {
  const queryClient = useQueryClient();
  const [post, setPost] = useState<SocialPost>(initialPost);
  const [showComments, setShowComments] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [activeMediaModal, setActiveMediaModal] = useState<PostMedia | null>(null);
  const [heartBurst, setHeartBurst] = useState(false);

  useAndroidBackNavigation(
    Boolean(activeMediaModal),
    () => setActiveMediaModal(null),
    "postMediaLightbox",
  );

  // Sync internal state if prop changes
  if (initialPost.id !== post.id || initialPost.reactionsCount !== post.reactionsCount) {
    setPost(initialPost);
  }

  const isMe = Boolean(me && me.id === post.authorId);
  const isMyRepost = Boolean(me && post.isRepost && post.reposter?.id === me.id);
  const canDelete = isMe || isMyRepost;

  async function handleReaction() {
    if (!me) {
      toast.error("Please sign in to like posts.");
      return;
    }
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 400);

    const nextReacted = !post.hasReacted;
    const prev = post;
    const updatedPost: SocialPost = {
      ...post,
      hasReacted: nextReacted,
      reactionsCount: Math.max(0, post.reactionsCount + (nextReacted ? 1 : -1)),
    };
    setPost(updatedPost);
    onPostUpdated?.(updatedPost);

    try {
      const counts = await setPostLiked(post.postId, nextReacted);
      const synced: SocialPost = {
        ...updatedPost,
        reactionsCount: counts.reactionsCount,
      };
      setPost(synced);
      onPostUpdated?.(synced);
    } catch (err) {
      setPost(prev);
      onPostUpdated?.(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update like.");
    }
  }

  async function handleSave() {
    if (!me) {
      toast.error("Please sign in to bookmark posts.");
      return;
    }
    const nextSaved = !post.hasSaved;
    const prev = post;
    const updatedPost: SocialPost = {
      ...post,
      hasSaved: nextSaved,
      savesCount: Math.max(0, post.savesCount + (nextSaved ? 1 : -1)),
    };
    setPost(updatedPost);
    toast(nextSaved ? "Saved to your bookmarks" : "Removed from bookmarks");

    try {
      const counts = await setPostSaved(post.postId, nextSaved);
      setPost((p) => ({ ...p, savesCount: counts.savesCount }));
      await queryClient.invalidateQueries({ queryKey: postsKeys.saved() });
    } catch (err) {
      setPost(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update bookmark.");
    }
  }

  async function handleDelete() {
    try {
      await deletePost(post.id);
      toast.info("Post deleted");
      await queryClient.invalidateQueries({ queryKey: postsKeys.all });
      onDeleted?.(post.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete post.");
    }
  }

  async function handleBlock() {
    try {
      await blockUser(post.authorId);
      toast.success(`Blocked @${post.authorUsername}`, {
        description: "Their posts and profile will no longer appear in your feed.",
      });
      await queryClient.invalidateQueries({ queryKey: postsKeys.all });
      onDeleted?.(post.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't block user.");
    }
  }

  async function handleCopy() {
    const url = `${window.location.origin}/u/${post.authorUsername}`;
    await navigator.clipboard.writeText(url);
    toast.success("Post link copied");
  }

  const timeFormatted = formatTimeAgo(new Date(post.createdAt));

  return (
    <article className="relative rounded-xl p-4 sm:p-5 border border-border bg-card shadow-sm transition-colors">
      {/* Repost Header Attribution */}
      {post.isRepost && post.reposter && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-2 min-w-0">
            <Repeat className="h-3.5 w-3.5 text-[#E91E63] shrink-0" />
            <span className="truncate">
              <Link
                to="/u/$username"
                params={{ username: post.reposter.username }}
                className="font-semibold text-foreground hover:text-[#E91E63]"
              >
                {post.reposter.name}
              </Link>{" "}
              reposted
            </span>
          </div>
          {post.repostedAt && (
            <span className="text-[0.65rem] shrink-0 text-muted-foreground">
              {formatTimeAgo(new Date(post.repostedAt))}
            </span>
          )}
        </div>
      )}

      {/* Repost Note */}
      {post.isRepost && post.repostNote && (
        <div className="mb-3 rounded-lg border border-border/70 bg-secondary/40 p-3 text-xs text-foreground leading-relaxed">
          <p className="font-semibold text-muted-foreground text-[0.65rem] uppercase tracking-wider mb-1">
            Note
          </p>
          <p className="whitespace-pre-line">{renderStyledText(post.repostNote)}</p>
        </div>
      )}

      {/* If original post was deleted or is private */}
      {post.originalUnavailable ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-1">
          <AlertCircle className="h-5 w-5 mx-auto text-muted-foreground/60 mb-1" />
          <p className="font-medium text-foreground">Original post unavailable</p>
          <p className="text-[0.7rem]">
            This post may have been deleted or is restricted by the author&apos;s privacy settings.
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <Link
              to="/u/$username"
              params={{ username: post.authorUsername }}
              className="flex items-center gap-3 group min-w-0"
            >
              <UserAvatar
                profile={{
                  avatar_url: post.authorAvatarUrl,
                  username: post.authorUsername,
                  display_name: post.authorName,
                }}
                className="h-10 w-10 ring-1 ring-border group-hover:ring-[#E91E63] transition-all shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-foreground group-hover:text-[#E91E63] transition-colors truncate">
                    {post.authorName}
                  </span>
                  {(post.authorPoints ?? 0) > 100 && (
                    <BadgeCheck className="h-4 w-4 text-[#E91E63] shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground">@{post.authorUsername}</span>
                </div>
                <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                  <span>{timeFormatted}</span>
                  {post.isEdited && <span>· edited</span>}
                  {post.location && (
                    <span className="flex items-center gap-0.5">
                      · <MapPin className="h-3 w-3 inline" /> {post.location}
                    </span>
                  )}
                  {post.mood && <span>· {post.mood}</span>}
                </div>
              </div>
            </Link>

            {/* More Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Post options"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
                <DropdownMenuItem onClick={handleCopy} className="text-xs cursor-pointer">
                  <Copy className="h-3.5 w-3.5 mr-2" /> Copy link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSave} className="text-xs cursor-pointer">
                  <Bookmark className="h-3.5 w-3.5 mr-2" />
                  {post.hasSaved ? "Remove from saved" : "Save post"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShareOpen(true)}
                  className="text-xs cursor-pointer"
                >
                  <Share2 className="h-3.5 w-3.5 mr-2" /> Share post
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {canDelete ? (
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-xs text-destructive cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete post
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={() => setReportOpen(true)}
                      className="text-xs text-destructive cursor-pointer"
                    >
                      <Flag className="h-3.5 w-3.5 mr-2" /> Report post
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleBlock}
                      className="text-xs text-destructive cursor-pointer"
                    >
                      <UserX className="h-3.5 w-3.5 mr-2" /> Block @{post.authorUsername}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Content Body */}
          {post.content && (
            <p className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-line">
              {renderStyledText(post.content)}
            </p>
          )}

          {/* Tag Badges */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium text-[#E91E63] hover:underline transition-colors cursor-pointer"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Media Presentation */}
          {post.media && post.media.length > 0 && (
            <div className="mt-3.5 overflow-hidden rounded-xl border border-border bg-black/5 dark:bg-black/40">
              {post.media.length === 1 ? (
                post.media[0]!.type === "video" ? (
                  <PostVideoPlayer
                    url={post.media[0]!.url}
                    storagePath={post.media[0]!.storagePath}
                    className="w-full"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveMediaModal(post.media![0]!)}
                    className="block w-full overflow-hidden text-left"
                  >
                    <img
                      src={post.media[0]!.url}
                      alt={post.media[0]!.caption || "Post photo"}
                      loading="lazy"
                      className="w-full max-h-[460px] object-cover hover:opacity-95 transition-opacity"
                    />
                  </button>
                )
              ) : post.media.length === 2 ? (
                <div className="grid grid-cols-2 gap-1 aspect-[16/10]">
                  {post.media.map((m) => renderGridMediaItem(m, () => setActiveMediaModal(m)))}
                </div>
              ) : post.media.length === 3 ? (
                <div className="grid grid-cols-2 gap-1 aspect-[4/3]">
                  {renderGridMediaItem(post.media[0]!, () => setActiveMediaModal(post.media![0]!))}
                  <div className="grid grid-rows-2 gap-1 h-full">
                    {post.media
                      .slice(1, 3)
                      .map((m) => renderGridMediaItem(m, () => setActiveMediaModal(m)))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1 aspect-square">
                  {post.media.slice(0, 4).map((m, idx) => (
                    <div key={m.id} className="relative h-full w-full overflow-hidden">
                      {renderGridMediaItem(m, () => setActiveMediaModal(m))}
                      {idx === 3 && post.media!.length > 4 && (
                        <div
                          onClick={() => setActiveMediaModal(m)}
                          className="cursor-pointer absolute inset-0 flex items-center justify-center bg-black/60 font-semibold text-xl text-white backdrop-blur-[2px]"
                        >
                          +{post.media!.length - 4}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Action Bar (Real SVG Icons with Pink Like State) */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        {/* Like Reaction */}
        <button
          type="button"
          onClick={handleReaction}
          className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
            post.hasReacted
              ? "text-[#E91E63] bg-[#E91E63]/10"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
          aria-label={post.hasReacted ? "Unlike post" : "Like post"}
        >
          <Heart
            className={`h-4 w-4 transition-transform ${
              heartBurst ? "scale-125" : ""
            } ${post.hasReacted ? "fill-[#E91E63] text-[#E91E63]" : ""}`}
          />
          <span>{post.reactionsCount > 0 ? post.reactionsCount : "Like"}</span>
        </button>

        {/* Comments Button */}
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
            showComments
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>{post.commentsCount > 0 ? post.commentsCount : "Comment"}</span>
        </button>

        {/* Share Button */}
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Repeat className="h-4 w-4" />
          <span>{post.sharesCount > 0 ? post.sharesCount : "Share"}</span>
        </button>

        {/* Bookmark / Save */}
        <button
          type="button"
          onClick={handleSave}
          className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-2 text-xs transition-colors ${
            post.hasSaved
              ? "text-[#E91E63] hover:text-[#C2185B]"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
          aria-label={post.hasSaved ? "Unsave post" : "Save post"}
        >
          <Bookmark className={`h-4 w-4 ${post.hasSaved ? "fill-[#E91E63] text-[#E91E63]" : ""}`} />
        </button>
      </div>

      {/* Inline Comments Section */}
      {showComments && (
        <CommentsSection
          postId={post.postId}
          me={me}
          onCommentChange={(delta = 1) => {
            setPost((p) => ({ ...p, commentsCount: Math.max(0, p.commentsCount + delta) }));
          }}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        post={post}
        me={me}
        open={shareOpen}
        onOpenChange={setShareOpen}
        onShared={() => {
          setPost((p) => ({ ...p, sharesCount: p.sharesCount + 1, hasShared: true }));
        }}
      />

      {/* Report Modal */}
      <ReportModal
        targetId={post.postId}
        targetType="post"
        targetLabel={`@${post.authorUsername}'s post`}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />

      {/* Media Lightbox Modal */}
      {activeMediaModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setActiveMediaModal(null)}
        >
          <button
            type="button"
            onClick={() => setActiveMediaModal(null)}
            className="absolute top-[max(env(safe-area-inset-top),1rem)] right-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
          <div
            className="max-h-[85vh] max-w-[90vw] overflow-hidden rounded-xl shadow-2xl flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {activeMediaModal.type === "video" ? (
              <PostVideoPlayer
                url={activeMediaModal.url}
                storagePath={activeMediaModal.storagePath}
                autoPlay={true}
                className="w-[85vw] max-w-4xl max-h-[85vh]"
              />
            ) : (
              <img
                src={activeMediaModal.url}
                alt={activeMediaModal.caption || ""}
                className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
              />
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function renderGridMediaItem(m: PostMedia, onClick: () => void) {
  if (m.type === "video") {
    return (
      <button
        key={m.id}
        type="button"
        onClick={onClick}
        className="relative h-full w-full overflow-hidden bg-black flex items-center justify-center group"
      >
        <video
          src={m.url || undefined}
          className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          preload="metadata"
          muted
          playsInline
          onError={(e) => {
            e.stopPropagation();
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm group-hover:scale-110 transition-transform">
            <Play className="h-4 w-4 ml-0.5 fill-current" />
          </span>
        </div>
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
          VIDEO
        </span>
      </button>
    );
  }
  return (
    <button
      key={m.id}
      type="button"
      onClick={onClick}
      className="h-full w-full overflow-hidden block"
    >
      <img
        src={m.url}
        alt={m.caption || "Post photo"}
        loading="lazy"
        className="h-full w-full object-cover hover:opacity-95 transition-opacity"
      />
    </button>
  );
}

function renderStyledText(text: string) {
  const parts = text.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("#")) {
      return (
        <span key={index} className="text-[#E91E63] font-medium cursor-pointer hover:underline">
          {part}
        </span>
      );
    }
    if (part.startsWith("@")) {
      return (
        <Link
          key={index}
          to="/u/$username"
          params={{ username: part.slice(1) }}
          className="text-[#E91E63] font-semibold hover:underline"
        >
          {part}
        </Link>
      );
    }
    return part;
  });
}

function formatTimeAgo(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
