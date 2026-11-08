import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlusSquare, Sparkles, Clapperboard, Camera, Layers } from "lucide-react";
import { PostComposer } from "@/components/feed/PostComposer";
import { VideoUploadModal } from "@/components/reels/VideoUploadModal";
import { StoryComposerModal } from "@/components/stories/StoryComposerModal";
import { myProfileQuery } from "@/services/profiles";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create in the Garden — VIDALORE SOCIAL" },
      { name: "description", content: "Publish posts, vertical reels, and 24h stories." },
      { property: "og:title", content: "Create in the Garden — VIDALORE SOCIAL" },
      { property: "og:description", content: "Publish posts, vertical reels, and 24h stories." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const { data: me, isLoading } = useQuery(myProfileQuery());
  const navigate = useNavigate();
  const [createMode, setCreateMode] = useState<"post" | "reel" | "story">("post");
  const [reelModalOpen, setReelModalOpen] = useState(false);
  const [storyModalOpen, setStoryModalOpen] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <PlusSquare className="h-6 w-6 text-primary" />
            Plant a Moment 🌹
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Share photography, prose, reels, or fleeting 24h stories.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-rose-soft">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>+10 VIDA POINTS</span>
        </div>
      </div>

      {/* Creation Mode Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-secondary/50 border border-border/60">
        <button
          type="button"
          onClick={() => setCreateMode("post")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
            createMode === "post"
              ? "bg-primary text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-4 w-4" /> Feed Post
        </button>

        <button
          type="button"
          onClick={() => {
            setCreateMode("reel");
            setReelModalOpen(true);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
            createMode === "reel"
              ? "bg-primary text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clapperboard className="h-4 w-4" /> Vertical Reel
        </button>

        <button
          type="button"
          onClick={() => {
            setCreateMode("story");
            setStoryModalOpen(true);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
            createMode === "story"
              ? "bg-primary text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-4 w-4" /> 24h Story
        </button>
      </div>

      {isLoading || !me ? (
        <Skeleton className="h-72 rounded-3xl" />
      ) : createMode === "post" ? (
        <PostComposer
          me={me}
          onPostCreated={() => {
            navigate({ to: "/home" });
          }}
        />
      ) : createMode === "reel" ? (
        <div className="glass rounded-3xl p-8 text-center space-y-4 border border-border/80">
          <Clapperboard className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <div>
            <h2 className="font-display text-2xl font-semibold">Publish a Vertical Reel</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Share high-definition vertical moments with original garden audio in the Reels stream.
            </p>
          </div>
          <Button
            type="button"
            variant="rose"
            onClick={() => setReelModalOpen(true)}
            className="rounded-full shadow-glow px-6 text-xs font-semibold"
          >
            Open Reel Uploader 🌹
          </Button>
        </div>
      ) : (
        <div className="glass rounded-3xl p-8 text-center space-y-4 border border-border/80">
          <Camera className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <div>
            <h2 className="font-display text-2xl font-semibold">Plant a 24-Hour Story</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Share fleeting snapshots and clips that bloom for 24 hours in your circle's stories
              bar.
            </p>
          </div>
          <Button
            type="button"
            variant="rose"
            onClick={() => setStoryModalOpen(true)}
            className="rounded-full shadow-glow px-6 text-xs font-semibold"
          >
            Open Story Composer 🌹
          </Button>
        </div>
      )}

      {/* Reel Modal */}
      <VideoUploadModal
        open={reelModalOpen}
        onOpenChange={(v) => {
          setReelModalOpen(v);
          if (!v) setCreateMode("post");
        }}
        me={me}
        onUploaded={() => {
          navigate({ to: "/reels" });
        }}
      />

      {/* Story Modal */}
      <StoryComposerModal
        open={storyModalOpen}
        onOpenChange={(v) => {
          setStoryModalOpen(v);
          if (!v) setCreateMode("post");
        }}
        me={me}
        onStoryPublished={() => {
          navigate({ to: "/home" });
        }}
      />
    </div>
  );
}
