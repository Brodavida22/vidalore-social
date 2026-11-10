import { Bookmark, BookmarkCheck, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { savedPostsQuery, setPostSaved, postsKeys } from "@/services/posts";
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
  const { data: savedPosts = [], isLoading } = useQuery({
    ...savedPostsQuery(),
    enabled: open && !!me,
  });

  async function handleRemove(postId: string) {
    try {
      await setPostSaved(postId, false);
      toast.info("Removed from saved collection");
      await queryClient.invalidateQueries({ queryKey: postsKeys.saved() });
      await queryClient.invalidateQueries({ queryKey: postsKeys.all });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove bookmark.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl border border-border bg-card p-5 max-h-[85vh] flex flex-col rounded-2xl shadow-xl">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="font-display text-xl flex items-center gap-2 text-foreground">
            <BookmarkCheck className="h-5 w-5 text-[#E91E63]" />
            Saved Posts
            {!isLoading && (
              <span className="text-xs text-muted-foreground font-sans font-normal">
                ({savedPosts.length})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {isLoading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-[#E91E63]" />
              <span>Loading saved collection...</span>
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <Bookmark className="h-10 w-10 text-muted-foreground/60 mx-auto" />
              <p className="font-semibold text-foreground text-sm">No saved posts yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Bookmark posts from your feed by clicking the bookmark icon to save them for later.
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
                    onClick={() => handleRemove(post.postId)}
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
