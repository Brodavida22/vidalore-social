import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Pause,
  UserX,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
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
import type { Profile } from "@/services/profiles";
import {
  togglePostReaction,
  togglePostSave,
  deletePost,
  blockUser,
  type SocialPost,
} from "@/services/social";

export function PostCard({
  post: initialPost,
  me,
  onDeleted,
  onPostUpdated,
}: {
  post: SocialPost;
  me?: Profile | null;
  onDeleted?: (id: string) => void;
  onPostUpdated?: (updated: SocialPost) => void;
}) {
  const [post, setPost] = useState<SocialPost>(initialPost);
  const [showComments, setShowComments] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [heartBurst, setHeartBurst] = useState(false);

  const isMe = Boolean(me && me.id === post.authorId);

  function handleReaction() {
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 600);
    const updated = togglePostReaction(post.id);
    if (updated) {
      setPost({ ...updated });
      onPostUpdated?.(updated);
    }
  }

  function handleSave() {
    const isSaved = togglePostSave(post.id);
    setPost((prev) => ({
      ...prev,
      hasSaved: isSaved,
      savesCount: Math.max(0, prev.savesCount + (isSaved ? 1 : -1)),
    }));
    toast(isSaved ? "Saved to your private collection 🌹" : "Removed from saved posts", {
      description: isSaved ? "Find it anytime on your profile or Saved tab." : undefined,
    });
  }

  function handleDelete() {
    deletePost(post.id);
    toast.info("Post removed from the Rose Garden");
    onDeleted?.(post.id);
  }

  function handleBlock() {
    blockUser(post.authorId);
    toast.success(`Blocked @${post.authorUsername}`, {
      description: "Their posts and profile will no longer appear in your feed.",
    });
    onDeleted?.(post.id);
  }

  async function handleCopy() {
    const url = `${window.location.origin}/u/${post.authorUsername}`;
    await navigator.clipboard.writeText(url);
    toast.success("Post link copied");
  }

  // Format timestamp
  const timeFormatted = formatTimeAgo(new Date(post.createdAt));

  return (
    <article className="glass relative rounded-3xl p-4 sm:p-5 shadow-card border border-border/80 transition-all hover:border-primary/25">
      {/* Repost Header Attribution */}
      {post.isRepost && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-secondary/40 px-3 py-1.5 text-xs text-rose-soft">
          <Repeat className="h-3.5 w-3.5 text-primary" />
          <span>
            <strong>{post.authorName}</strong> echoed
            {post.originalAuthor ? ` from @${post.originalAuthor.username}` : ""}
          </span>
        </div>
      )}

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
            className="h-10 w-10 sm:h-11 sm:w-11 ring-2 ring-primary/40 group-hover:ring-primary transition-all shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground group-hover:text-rose-soft transition-colors truncate">
                {post.authorName}
              </span>
              {post.authorVerified && (
                <span title="Verified Gardener" className="text-primary text-xs">
                  🌹
                </span>
              )}
              <span className="text-xs text-muted-foreground">@{post.authorUsername}</span>
            </div>
            <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
              <span>{timeFormatted}</span>
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
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 glass border-border/80">
            <DropdownMenuItem onClick={handleCopy} className="text-xs cursor-pointer">
              <Copy className="h-3.5 w-3.5 mr-2" /> Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSave} className="text-xs cursor-pointer">
              <Bookmark className="h-3.5 w-3.5 mr-2" />
              {post.hasSaved ? "Remove from saved" : "Save post"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareOpen(true)} className="text-xs cursor-pointer">
              <Share2 className="h-3.5 w-3.5 mr-2" /> Share post
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isMe ? (
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
        <p className="mt-3 text-sm text-foreground/95 leading-relaxed whitespace-pre-line">
          {renderStyledText(post.content)}
        </p>
      )}

      {/* Tag Badges */}
      {post.tags && post.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs font-medium text-rose-soft/90 hover:text-primary transition-colors cursor-pointer"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Media Presentation */}
      {post.media && post.media.length > 0 && (
        <div className="mt-3.5 overflow-hidden rounded-2xl border border-border/60 bg-black/30">
          {post.media.length === 1 ? (
            post.media[0]!.type === "video" ? (
              <div className="relative aspect-video w-full bg-black">
                <video
                  src={post.media[0]!.url}
                  className="h-full w-full object-cover"
                  autoPlay={isPlayingVideo}
                  muted={isMuted}
                  loop
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors">
                  <button
                    type="button"
                    onClick={() => setIsPlayingVideo(!isPlayingVideo)}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:scale-110 transition-transform"
                    aria-label={isPlayingVideo ? "Pause video" : "Play video"}
                  >
                    {isPlayingVideo ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-0.5" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="absolute bottom-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setActivePhotoModal(post.media![0]!.url)}
                className="block w-full overflow-hidden text-left"
              >
                <img
                  src={post.media[0]!.url}
                  alt={post.media[0]!.caption || "Post photo"}
                  loading="lazy"
                  className="w-full max-h-[460px] object-cover hover:scale-[1.01] transition-transform duration-300"
                />
              </button>
            )
          ) : post.media.length === 2 ? (
            <div className="grid grid-cols-2 gap-1">
              {post.media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActivePhotoModal(m.url)}
                  className="aspect-square w-full overflow-hidden"
                >
                  <img
                    src={m.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover hover:scale-105 transition-transform"
                  />
                </button>
              ))}
            </div>
          ) : post.media.length === 3 ? (
            <div className="grid grid-cols-2 gap-1 aspect-[4/3]">
              <button
                type="button"
                onClick={() => setActivePhotoModal(post.media![0]!.url)}
                className="h-full w-full overflow-hidden"
              >
                <img
                  src={post.media[0]!.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover hover:scale-105 transition-transform"
                />
              </button>
              <div className="grid grid-rows-2 gap-1 h-full">
                {post.media.slice(1, 3).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActivePhotoModal(m.url)}
                    className="h-full w-full overflow-hidden"
                  >
                    <img
                      src={m.url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover hover:scale-105 transition-transform"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1 aspect-square">
              {post.media.slice(0, 4).map((m, idx) => (
                <div key={m.id} className="relative h-full w-full overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActivePhotoModal(m.url)}
                    className="h-full w-full"
                  >
                    <img
                      src={m.url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover hover:scale-105 transition-transform"
                    />
                  </button>
                  {idx === 3 && post.media!.length > 4 && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 font-display text-2xl font-bold text-white">
                      +{post.media!.length - 4}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
        {/* Rose Reaction */}
        <button
          type="button"
          onClick={handleReaction}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
            post.hasReacted
              ? "bg-primary/20 text-primary shadow-glow"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
          aria-label={post.hasReacted ? "Unlike post" : "Rose react to post"}
        >
          <span
            className={`text-base leading-none transition-transform ${
              heartBurst ? "scale-150 animate-bounce" : ""
            } ${post.hasReacted ? "filter drop-shadow-[0_0_8px_var(--color-primary)]" : "opacity-75"}`}
          >
            🌹
          </span>
          <span>{post.reactionsCount > 0 ? post.reactionsCount : "Rose"}</span>
        </button>

        {/* Comments Button */}
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
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
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
        >
          <Repeat className="h-4 w-4" />
          <span>{post.sharesCount > 0 ? post.sharesCount : "Echo"}</span>
        </button>

        {/* Bookmark / Save */}
        <button
          type="button"
          onClick={handleSave}
          className={`rounded-full p-2 text-xs transition-all ${
            post.hasSaved
              ? "text-primary hover:text-primary-deep"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
          aria-label={post.hasSaved ? "Unsave post" : "Save post"}
        >
          <Bookmark className={`h-4 w-4 ${post.hasSaved ? "fill-primary" : ""}`} />
        </button>
      </div>

      {/* Inline Comments Section */}
      {showComments && (
        <CommentsSection
          postId={post.id}
          me={me}
          onCommentChange={() => {
            setPost((p) => ({ ...p, commentsCount: p.commentsCount + 1 }));
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
          setPost((p) => ({ ...p, sharesCount: p.sharesCount + 1 }));
        }}
      />

      {/* Report Modal */}
      <ReportModal
        targetId={post.id}
        targetType="post"
        targetLabel={`@${post.authorUsername}'s post`}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />

      {/* Photo Lightbox Modal */}
      {activePhotoModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setActivePhotoModal(null)}
        >
          <button
            type="button"
            onClick={() => setActivePhotoModal(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            aria-label="Close photo"
          >
            ✕
          </button>
          <img
            src={activePhotoModal}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </article>
  );
}

function renderStyledText(text: string) {
  const parts = text.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("#")) {
      return (
        <span key={index} className="text-rose-soft font-medium cursor-pointer hover:underline">
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
          className="text-primary font-semibold hover:underline"
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
