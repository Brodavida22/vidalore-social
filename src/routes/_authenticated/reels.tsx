import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Upload, ChevronUp, ChevronDown, Grid, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReelPlayer } from "@/components/reels/ReelPlayer";
import { VideoUploadModal } from "@/components/reels/VideoUploadModal";
import { myProfileQuery } from "@/services/profiles";
import { getStoredReels, type ReelItem } from "@/services/reelsAndStories";

export const Route = createFileRoute("/_authenticated/reels")({
  head: () => ({
    meta: [
      { title: "Reels — VIDALORE SOCIAL" },
      {
        name: "description",
        content: "Watch and share vertical short videos from the VIDALORE community.",
      },
      { property: "og:title", content: "Reels — VIDALORE SOCIAL" },
      { property: "og:description", content: "Watch and share vertical video moments." },
      { property: "og:type", content: "video" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReelsPage,
});

function ReelsPage() {
  const { data: me } = useQuery(myProfileQuery());
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tab, setTab] = useState<"stream" | "grid">("stream");

  const touchStartY = useRef<number | null>(null);

  const reloadReels = useCallback(async () => {
    try {
      setReels(await getStoredReels());
    } catch (error) {
      console.error("Failed to load reels", error);
    }
  }, []);

  useEffect(() => {
    void reloadReels();
  }, [reloadReels]);

  useEffect(() => {
    const handleUpdate = () => {
      void reloadReels();
    };
    window.addEventListener("vidalore:reels-updated", handleUpdate);
    return () => window.removeEventListener("vidalore:reels-updated", handleUpdate);
  }, [reloadReels]);

  const handleNext = useCallback(() => {
    if (activeIndex < reels.length - 1) {
      setActiveIndex((prev) => prev + 1);
    }
  }, [activeIndex, reels.length]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
    }
  }, [activeIndex]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (tab !== "stream") return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        handlePrev();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tab, handleNext, handlePrev]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? 0;
    const diff = touchStartY.current - endY;
    const SWIPE_THRESHOLD = 50;

    if (diff > SWIPE_THRESHOLD) {
      handleNext();
    } else if (diff < -SWIPE_THRESHOLD) {
      handlePrev();
    }
    touchStartY.current = null;
  }

  const currentReel = reels[activeIndex];

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] flex flex-col justify-between max-w-5xl mx-auto px-2 sm:px-4 py-2">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border z-20">
        <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setTab("stream")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab === "stream"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            For You
          </button>
          <button
            type="button"
            onClick={() => setTab("grid")}
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab === "grid"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid className="h-3 w-3" /> Grid View
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="rounded-lg text-xs h-8 px-3 font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm"
          >
            <Upload className="h-3.5 w-3.5 mr-1" /> Upload Reel
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {tab === "stream" ? (
        <div
          className="relative flex-1 flex items-center justify-center py-2"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {reels.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
              <Clapperboard className="h-10 w-10 text-[#E91E63] mx-auto" />
              <h2 className="font-display text-xl font-bold text-foreground">No reels yet</h2>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Reels shared by users will appear here.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setUploadOpen(true)}
                className="rounded-lg bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs"
              >
                Upload First Reel
              </Button>
            </div>
          ) : (
            <div className="relative w-full flex items-center justify-center">
              {/* Active Reel */}
              {currentReel && (
                <ReelPlayer
                  key={currentReel.id}
                  reel={currentReel}
                  isActive={true}
                  isMuted={isMuted}
                  onToggleMute={() => setIsMuted(!isMuted)}
                  me={me}
                />
              )}

              {/* Desktop Next / Prev Navigation Buttons */}
              <div className="hidden md:flex flex-col gap-2 absolute right-8 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={handlePrev}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-30 transition-colors"
                  aria-label="Previous reel"
                >
                  <ChevronUp className="h-5 w-5" />
                </button>
                <span className="text-center text-[0.7rem] text-muted-foreground font-mono">
                  {activeIndex + 1}/{reels.length}
                </span>
                <button
                  type="button"
                  disabled={activeIndex === reels.length - 1}
                  onClick={handleNext}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-30 transition-colors"
                  aria-label="Next reel"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Reel Discovery Grid */
        <div className="flex-1 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Trending Reels
            </h2>
            <span className="text-xs text-muted-foreground">{reels.length} videos</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {reels.map((reel, idx) => (
              <div
                key={reel.id}
                onClick={() => {
                  setActiveIndex(idx);
                  setTab("stream");
                }}
                className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-black cursor-pointer border border-border hover:border-primary transition-all shadow-sm"
              >
                <video src={reel.videoUrl} className="h-full w-full object-cover" muted />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-2.5">
                  <span className="self-end rounded bg-black/60 px-2 py-0.5 text-[0.65rem] text-white font-medium">
                    {reel.likesCount} likes
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-white truncate">
                      @{reel.creatorUsername}
                    </p>
                    <p className="text-[0.65rem] text-white/80 line-clamp-1">{reel.caption}</p>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                    <Play className="h-5 w-5 ml-0.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      <VideoUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        me={me}
        onUploaded={() => {
          reloadReels();
          setActiveIndex(0);
        }}
      />
    </div>
  );
}
