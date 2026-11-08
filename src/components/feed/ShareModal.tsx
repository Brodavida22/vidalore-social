import { useState } from "react";
import { Copy, Check, Repeat, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SocialPost } from "@/services/social";
import { sharePost } from "@/services/social";
import type { Profile } from "@/services/profiles";

export function ShareModal({
  post,
  me,
  open,
  onOpenChange,
  onShared,
}: {
  post: SocialPost;
  me?: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShared?: () => void;
}) {
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
          title: `Post by @${post.authorUsername} on VIDALORE SOCIAL`,
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

  function handleRepost() {
    if (!me) {
      toast.error("Please sign in to echo moments.");
      return;
    }
    setIsReposting(true);
    try {
      sharePost(me, post.id, repostNote.trim() || undefined);
      toast.success("Reposted to the Rose Garden 🌹", {
        description: "Shared with your circles and followers.",
      });
      onShared?.();
      onOpenChange(false);
    } catch {
      toast.error("Failed to repost");
    } finally {
      setIsReposting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass border-border/80">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Share Moment 🌹</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Spread blooming ideas across the garden or via link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Echo/Repost with note */}
          <div className="rounded-2xl bg-secondary/50 p-3.5 space-y-2 border border-border/60">
            <span className="text-xs font-semibold text-rose-soft flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5 text-primary" />
              Echo to Garden Feed
            </span>
            <Textarea
              placeholder="Add your thoughts or quote this moment... (optional)"
              value={repostNote}
              onChange={(e) => setRepostNote(e.target.value)}
              rows={2}
              className="resize-none rounded-xl bg-background/60 text-xs"
            />
            <Button
              type="button"
              variant="rose"
              size="sm"
              disabled={isReposting}
              onClick={handleRepost}
              className="w-full text-xs font-semibold shadow-glow"
            >
              Echo to My Feed 🌹
            </Button>
          </div>

          {/* Quick link & native sharing */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="glass"
              onClick={handleCopy}
              className="text-xs flex items-center justify-center gap-2 h-10 rounded-xl"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied ? "Link Copied" : "Copy Link"}
            </Button>

            <Button
              type="button"
              variant="glass"
              onClick={handleNativeShare}
              className="text-xs flex items-center justify-center gap-2 h-10 rounded-xl"
            >
              <Share2 className="h-4 w-4 text-primary" />
              Share Outside
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
