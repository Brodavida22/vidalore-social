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
      { title: "Create — VIDALORE SOCIAL" },
      { name: "description", content: "Publish posts, vertical reels, and 24h stories." },
      { property: "og:title", content: "Create — VIDALORE SOCIAL" },
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
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2 text-foreground">
            <PlusSquare className="h-6 w-6 text-primary" />
            Create
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Publish posts, share short-form reels, or post 24-hour stories.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1 text-xs text-muted-foreground font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>+10 points per post</span>
        </div>
      </div>

      {/* Creation Mode Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-secondary border border-border">
        <button
          type="button"
          onClick={() => setCreateMode("post")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
            createMode === "post"
              ? "bg-card text-foreground shadow-sm"
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
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
            createMode === "reel"
              ? "bg-card text-foreground shadow-sm"
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
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
            createMode === "story"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-4 w-4" /> 24h Story
        </button>
      </div>

      {isLoading || !me ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : createMode === "post" ? (
        <PostComposer
          me={me}
          onPostCreated={() => {
            navigate({ to: "/home" });
          }}
        />
      ) : createMode === "reel" ? (
        <div className="rounded-xl p-8 text-center space-y-4 border border-border bg-card">
          <Clapperboard className="h-10 w-10 text-primary mx-auto" />
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              Upload a Vertical Reel
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Share high-definition vertical video in the dedicated Reels feed.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setReelModalOpen(true)}
            className="rounded-lg px-5 text-xs font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm"
          >
            Open Reel Uploader
          </Button>
        </div>
      ) : (
        <div className="rounded-xl p-8 text-center space-y-4 border border-border bg-card">
          <Camera className="h-10 w-10 text-primary mx-auto" />
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Post a 24-Hour Story</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Share quick photo or video updates visible for 24 hours at the top of the feed.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setStoryModalOpen(true)}
            className="rounded-lg px-5 text-xs font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm"
          >
            Open Story Composer
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
