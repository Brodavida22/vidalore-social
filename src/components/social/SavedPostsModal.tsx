import { useState, useEffect } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Trash2,
  Loader2,
  Play,
  Clapperboard,
  Heart,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { savedPostsQuery, setPostSaved, postsKeys } from "@/services/posts";
import { getSavedReels, removeSavedReel } from "@/services/reelsAndStories";
import type { Profile } from "@/services/profiles";

export function SavedPostsModal({
  open,
  onOpenChange,
  me,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me?: Profile | null | undefined;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"posts" | "reels">("posts");

  const { data: savedPosts = [], isLoading: isLoadingPosts } = useQuery({
    ...savedPostsQuery(),
    enabled: open && !!me,
  });

  const {
    data: savedReels = [],
    isLoading: isLoadingReels,
    refetch: refetchSavedReels,
  } = useQuery({
    queryKey: ["saved-reels", me?.id],
    queryFn: () => getSavedReels(),
    enabled: open && !!me,
  });

  // Re-fetch saved reels when updated
  useEffect(() => {
    if (!open) return;
    const handleUpdate = () => {
      void refetchSavedReels();
    };
    window.addEventListener("vidalore:reels-updated", handleUpdate);
    return () => window.removeEventListener("vidalore:reels-updated", handleUpdate);
  }, [open, refetchSavedReels]);

  async function handleRemovePost(postId: string) {
    try {
      await setPostSaved(postId, false);
      toast.info("Removed from saved collection");
      await queryClient.invalidateQueries({ queryKey: postsKeys.saved() });
      await queryClient.invalidateQueries({ queryKey: postsKeys.all });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove bookmark.");
    }
  }

  async function handleRemoveReel(reelId: string) {
    try {
      await removeSavedReel(reelId);
      toast.info("Removed from saved reels");
      await queryClient.invalidateQueries({ queryKey: ["saved-reels", me?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove saved reel.");
    }
  }

  function handlePlayReel(reelId: string) {
    onOpenChange(false);
    void navigate({ to: "/reels", search: { reelId } });
  }

  const isLoading = activeTab === "posts" ? isLoadingPosts : isLoadingReels;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl border border-border bg-card p-5 max-h-[85vh] flex flex-col rounded-2xl shadow-xl">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-xl flex items-center gap-2 text-foreground">
              <BookmarkCheck className="h-5 w-5 text-[#E91E63]" />
              Saved Collection
            </DialogTitle>
          </div>

          {/* Tab Selector: Posts vs Reels */}
          <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl mt-3 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("posts")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "posts"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Saved Posts ({savedPosts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reels")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "reels"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clapperboard className="h-3.5 w-3.5 text-[#E91E63]" />
              Saved Reels ({savedReels.length})
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-[220px]">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-[#E91E63]" />
              <span>Loading saved collection...</span>
            </div>
          ) : activeTab === "posts" ? (
            savedPosts.length === 0 ? (
              <div className="py-14 text-center space-y-2">
                <Bookmark className="h-10 w-10 text-muted-foreground/60 mx-auto" />
                <p className="font-semibold text-foreground text-sm">No saved posts yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Bookmark posts from your feed by clicking the bookmark icon to save them for
                  later.
                </p>
              </div>
            ) : (
              savedPosts.map((post) => (
                <div
                  key={post.id}
                  className="group relative rounded-xl bg-secondary/40 p-3.5 border border-border/60 hover:border-[#E91E63]/40 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      to="/u/$username"
                      params={{ username: post.authorUsername }}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center gap-2"
                    >
                      <UserAvatar
                        profile={{
                          avatar_url: post.authorAvatarUrl,
                          username: post.authorUsername,
                          display_name: post.authorName,
                        }}
                        className="h-7 w-7 text-xs"
                      />
                      <div>
                        <span className="text-xs font-semibold text-foreground hover:text-[#E91E63] transition-colors">
                          {post.authorName}
                        </span>
                        <span className="text-[0.65rem] text-muted-foreground ml-1.5">
                          @{post.authorUsername}
                        </span>
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleRemovePost(post.postId)}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
                      title="Remove from saved"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {post.content && (
                    <p className="text-xs text-foreground/90 line-clamp-3 leading-relaxed">
                      {post.content}
                    </p>
                  )}

                  {post.media && post.media.length > 0 && (
                    <div className="h-28 w-full rounded-xl overflow-hidden bg-black/30">
                      <img src={post.media[0]!.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground pt-1">
                    <span>{post.reactionsCount} reactions</span>
                    <span>{post.commentsCount} comments</span>
                  </div>
                </div>
              ))
            )
          ) : savedReels.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <Clapperboard className="h-10 w-10 text-muted-foreground/60 mx-auto" />
              <p className="font-semibold text-foreground text-sm">No saved reels yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Bookmark Reels by tapping the bookmark icon while watching to save them to your
                collection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedReels.map((reel) => (
                <div
                  key={reel.id}
                  className="group relative rounded-xl bg-secondary/40 p-3 border border-border/60 hover:border-[#E91E63]/40 transition-all flex flex-col justify-between space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      to="/u/$username"
                      params={{ username: reel.creatorUsername }}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center gap-2 min-w-0"
                    >
                      <UserAvatar
                        profile={{
                          avatar_url: reel.creatorAvatarUrl,
                          username: reel.creatorUsername,
                          display_name: reel.creatorName,
                        }}
                        className="h-7 w-7 text-xs shrink-0"
                      />
                      <div className="truncate">
                        <span className="text-xs font-semibold text-foreground hover:text-[#E91E63] transition-colors truncate block">
                          @{reel.creatorUsername}
                        </span>
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleRemoveReel(reel.id)}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors shrink-0"
                      title="Remove from saved reels"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Reel Thumbnail / Preview with Play Overlay */}
                  <div
                    onClick={() => handlePlayReel(reel.id)}
                    className="relative aspect-[9/14] w-full rounded-xl overflow-hidden bg-black cursor-pointer shadow-sm group/video"
                  >
                    <video
                      src={reel.videoUrl || undefined}
                      className="h-full w-full object-cover opacity-85 group-hover/video:opacity-100 transition-opacity"
                      muted
                      playsInline
                      preload="metadata"
                      onError={(e) => {
                        e.stopPropagation();
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E91E63] text-white shadow-lg group-hover/video:scale-110 active:scale-95 transition-transform">
                        <Play className="h-5 w-5 ml-0.5 fill-current" />
                      </span>
                    </div>

                    {/* Likes & Comments Badges */}
                    <div className="absolute bottom-2 inset-x-2 flex items-center justify-between text-[0.65rem] text-white/90">
                      <div className="flex items-center gap-1 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded">
                        <Heart className="h-3 w-3 fill-[#E91E63] text-[#E91E63]" />
                        <span>{reel.likesCount}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded">
                        <MessageCircle className="h-3 w-3 text-white" />
                        <span>{reel.commentsCount}</span>
                      </div>
                    </div>
                  </div>

                  {reel.caption && (
                    <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed">
                      {reel.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
