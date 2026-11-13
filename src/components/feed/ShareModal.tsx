import { useState } from "react";
import { Copy, Check, Repeat, Share2, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SocialPost } from "@/services/posts";
import { repostPost, postsKeys, POST_LIMITS } from "@/services/posts";
import type { Profile } from "@/services/profiles";

export function ShareModal({
  post,
  me,
  open,
  onOpenChange,
  onShared,
}: {
  post: SocialPost;
  me?: Profile | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShared?: () => void;
}) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [repostNote, setRepostNote] = useState("");
  const [isReposting, setIsReposting] = useState(false);

  const postUrl =
    typeof window !== "undefined" ? `${window.location.origin}/u/${post.authorUsername}` : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      toast.success("Post link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by @${post.authorUsername} on VIDALORE`,
          text: post.content.slice(0, 100),
          url: postUrl,
        });
        toast.success("Shared successfully");
        onOpenChange(false);
      } catch {
        // cancelled
      }
    } else {
      handleCopy();
    }
  }

  async function handleRepost() {
    if (!me) {
      toast.error("Please sign in to share posts.");
      return;
    }
    setIsReposting(true);
    try {
      await repostPost(post.postId, repostNote.trim() || undefined);
      toast.success("Post reposted to your feed");
      await queryClient.invalidateQueries({ queryKey: postsKeys.all });
      onShared?.();
      onOpenChange(false);
      setRepostNote("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to repost.";
      toast.error(msg);
    } finally {
      setIsReposting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-semibold text-foreground">
            Share Post
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Share this post with your followers or copy the direct link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Repost with note */}
          <div className="rounded-xl bg-secondary p-3.5 space-y-2.5 border border-border">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5 text-[#E91E63]" />
              Repost to Feed
            </span>
            <Textarea
              placeholder="Add your thoughts... (optional)"
              value={repostNote}
              onChange={(e) => setRepostNote(e.target.value)}
              rows={2}
              maxLength={POST_LIMITS.maxRepostNote}
              className="resize-none rounded-lg bg-card text-xs border-border"
            />
            <Button
              type="button"
              size="sm"
              disabled={isReposting}
              onClick={handleRepost}
              className="w-full text-xs font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white rounded-lg shadow-sm"
            >
              {isReposting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Reposting...
                </>
              ) : (
                "Share to Feed"
              )}
            </Button>
          </div>

          {/* Quick link & native sharing */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="text-xs flex items-center justify-center gap-2 h-9 rounded-lg border-border hover:bg-secondary"
            >
              {copied ? <Check className="h-4 w-4 text-[#22C55E]" /> : <Copy className="h-4 w-4" />}
              {copied ? "Link Copied" : "Copy Link"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleNativeShare}
              className="text-xs flex items-center justify-center gap-2 h-9 rounded-lg border-border hover:bg-secondary"
            >
              <Share2 className="h-4 w-4 text-[#E91E63]" />
              External Share
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
