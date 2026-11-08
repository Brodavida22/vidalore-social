import { useState } from "react";
import { Bookmark, BookmarkCheck, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { getStoredPosts, togglePostSave, type SocialPost } from "@/services/social";
import type { Profile } from "@/services/profiles";

export function SavedPostsModal({
  open,
  onOpenChange,
  me,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me?: Profile | null;
}) {
  const [savedPosts, setSavedPosts] = useState<SocialPost[]>(() =>
    getStoredPosts().filter((p) => p.hasSaved),
  );

  function handleRemove(postId: string) {
    togglePostSave(postId);
    setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
    toast.info("Removed from saved collection");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl glass border-border/80 p-5 max-h-[85vh] flex flex-col">
        <DialogHeader className="border-b border-border/60 pb-3">
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <BookmarkCheck className="h-5 w-5 text-primary" />
            Saved Moments 🌹
            <span className="text-xs text-muted-foreground font-sans font-normal">
              ({savedPosts.length})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {savedPosts.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <Bookmark className="h-10 w-10 text-muted-foreground/60 mx-auto" />
              <p className="font-semibold text-foreground">No saved posts yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Bookmark posts from your garden feed by clicking the bookmark icon to save
                inspirations for later.
              </p>
            </div>
          ) : (
            savedPosts.map((post) => (
              <div
                key={post.id}
                className="group relative rounded-2xl bg-secondary/40 p-4 border border-border/50 hover:border-primary/30 transition-all space-y-2"
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
                      <span className="text-xs font-semibold text-foreground hover:text-rose-soft">
                        {post.authorName}
                      </span>
                      <span className="text-[0.65rem] text-muted-foreground ml-1.5">
                        @{post.authorUsername}
                      </span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleRemove(post.id)}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
                    title="Remove from saved"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="text-xs text-foreground/90 line-clamp-3 leading-relaxed">
                  {post.content}
                </p>

                {post.media && post.media.length > 0 && (
                  <div className="h-28 w-full rounded-xl overflow-hidden bg-black/30">
                    <img src={post.media[0]!.url} alt="" className="h-full w-full object-cover" />
                  </div>
                )}

                <div className="flex items-center justify-between text-[0.7rem] text-rose-soft pt-1">
                  <span>🌹 {post.reactionsCount} reactions</span>
                  <span>{post.commentsCount} comments</span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
