import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Clapperboard,
  Upload,
  ChevronUp,
  ChevronDown,
  Grid,
  Play,
  Bookmark,
  Eye,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ReelPlayer } from "@/components/reels/ReelPlayer";
import { VideoUploadModal } from "@/components/reels/VideoUploadModal";
import { useVideoAudioPreference } from "@/lib/videoAudioPreference";
import { prefetchVideoUrl } from "@/lib/videoPrefetch";
import { myProfileQuery } from "@/services/profiles";
import {
  getStoredReels,
  getSavedReels,
  removeSavedReel,
  type ReelItem,
} from "@/services/reelsAndStories";

interface ReelsSearch {
  reelId?: string | undefined;
  id?: string | undefined;
}

export const Route = createFileRoute("/_authenticated/reels")({
  validateSearch: (search: Record<string, unknown>): ReelsSearch => ({
    reelId: typeof search["reelId"] === "string" ? search["reelId"] : undefined,
    id: typeof search["id"] === "string" ? search["id"] : undefined,
  }),
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
  const search = Route.useSearch();
  const targetReelId = search.reelId || search.id;
  const { data: me } = useQuery(myProfileQuery());
  const { preferredMuted, setPreferredMuted, togglePreferredMuted } = useVideoAudioPreference();
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [savedReels, setSavedReels] = useState<ReelItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tab, setTab] = useState<"stream" | "grid" | "saved">("stream");

  const touchStartY = useRef<number | null>(null);

  const reloadReels = useCallback(async () => {
    try {
      const items = await getStoredReels();
      const list = Array.isArray(items) ? items : [];
      setReels(list);
      if (targetReelId) {
        const foundIdx = list.findIndex((r) => r.id === targetReelId);
        if (foundIdx >= 0) {
          setActiveIndex(foundIdx);
          setTab("stream");
        }
      }
    } catch (error) {
      console.warn("Could not load reels:", error);
      setReels([]);
    }
  }, [targetReelId]);

  const reloadSavedReels = useCallback(async () => {
    setSavedLoading(true);
    try {
      const items = await getSavedReels();
      setSavedReels(Array.isArray(items) ? items : []);
    } catch (error) {
      console.warn("Could not load saved reels:", error);
      setSavedReels([]);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadReels();
  }, [reloadReels]);

  useEffect(() => {
    if (tab === "saved") {
      void reloadSavedReels();
    }
  }, [tab, reloadSavedReels]);

  useEffect(() => {
    const handleUpdate = () => {
      void reloadReels();
      if (tab === "saved") {
        void reloadSavedReels();
      }
    };
    window.addEventListener("vidalore:reels-updated", handleUpdate);
    return () => window.removeEventListener("vidalore:reels-updated", handleUpdate);
  }, [reloadReels, reloadSavedReels, tab]);

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
  const nextReel = reels[activeIndex + 1];

  // Prefetch only the next upcoming Reel without loading all videos simultaneously
  useEffect(() => {
    if (tab === "stream" && nextReel?.videoUrl) {
      prefetchVideoUrl(nextReel.videoUrl);
    }
  }, [tab, nextReel?.videoUrl]);

  async function handleUnsaveFromList(reelId: string) {
    const previous = savedReels;
    setSavedReels((prev) => prev.filter((r) => r.id !== reelId));
    try {
      await removeSavedReel(reelId);
      toast.info("Removed from saved");
    } catch (err) {
      setSavedReels(previous);
      toast.error(err instanceof Error ? err.message : "Could not remove saved reel.");
    }
  }

  function handleOpenSavedReel(reel: ReelItem) {
    const existingIdx = reels.findIndex((r) => r.id === reel.id);
    if (existingIdx >= 0) {
      setActiveIndex(existingIdx);
    } else {
      setReels((prev) => [reel, ...prev]);
      setActiveIndex(0);
    }
    setTab("stream");
  }

  return (
    <div className="relative min-h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] md:min-h-[calc(100dvh-2rem)] flex flex-col justify-between max-w-5xl mx-auto px-2 sm:px-4 py-2">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border z-20 gap-2">
        <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg overflow-x-auto scrollbar-none min-w-0">
          <button
            type="button"
            onClick={() => setTab("stream")}
            className={`min-h-[36px] rounded-md px-2.5 sm:px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
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
            className={`flex min-h-[36px] items-center gap-1 rounded-md px-2.5 sm:px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              tab === "grid"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid className="h-3 w-3" /> Grid
          </button>
          <button
            type="button"
            onClick={() => setTab("saved")}
            className={`flex min-h-[36px] items-center gap-1 rounded-md px-2.5 sm:px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              tab === "saved"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bookmark className="h-3 w-3" /> Saved
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="rounded-lg text-xs h-9 px-3 font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5 sm:mr-1" />{" "}
            <span className="hidden xs:inline sm:inline">Upload Reel</span>
            <span className="xs:hidden sm:hidden">Upload</span>
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
                  isMuted={preferredMuted}
                  onToggleMute={() => {
                    togglePreferredMuted();
                  }}
                  onEnableSound={() => {
                    setPreferredMuted(false);
                  }}
                  me={me}
                />
              )}

              {/* Warm metadata only for the next single reel */}
              {nextReel?.videoUrl && (
                <video
                  key={`preload-${nextReel.id}`}
                  src={nextReel.videoUrl}
                  preload="metadata"
                  muted
                  playsInline
                  className="hidden"
                  aria-hidden="true"
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
      ) : tab === "grid" ? (
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
                onMouseEnter={() => prefetchVideoUrl(reel.videoUrl)}
                onClick={() => {
                  setActiveIndex(idx);
                  setTab("stream");
                }}
                className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-black cursor-pointer border border-border hover:border-primary transition-all shadow-sm"
              >
                <video
                  src={reel.videoUrl || undefined}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  onError={(e) => {
                    e.stopPropagation();
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-2.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[0.65rem] text-white font-medium">
                      <Eye className="h-3 w-3" />
                      {reel.viewsCount.toLocaleString()}
                    </span>
                    <span className="rounded bg-black/60 px-2 py-0.5 text-[0.65rem] text-white font-medium">
                      {reel.likesCount} likes
                    </span>
                  </div>
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
      ) : (
        /* Saved Reels Tab */
        <div className="flex-1 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Saved Reels
            </h2>
            <span className="text-xs text-muted-foreground">{savedReels.length} saved</span>
          </div>

          {savedLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading saved reels...
            </div>
          ) : savedReels.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
              <Bookmark className="h-9 w-9 text-[#E91E63] mx-auto" />
              <p className="font-semibold text-sm text-foreground">No saved reels yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Bookmark any reel while watching to keep it handy here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {savedReels.map((reel) => (
                <div
                  key={reel.id}
                  onMouseEnter={() => prefetchVideoUrl(reel.videoUrl)}
                  onClick={() => handleOpenSavedReel(reel)}
                  className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-black cursor-pointer border border-border hover:border-primary transition-all shadow-sm"
                >
                  <video
                    src={reel.videoUrl || undefined}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    onError={(e) => {
                      e.stopPropagation();
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleUnsaveFromList(reel.id);
                      }}
                      className="self-end rounded-full bg-black/70 p-1.5 text-[#E91E63] hover:bg-black/90 transition-colors"
                      aria-label="Remove from saved"
                      title="Remove from saved"
                    >
                      <Bookmark className="h-3.5 w-3.5 fill-[#E91E63]" />
                    </button>
                    <div>
                      <p className="text-xs font-semibold text-white truncate">
                        @{reel.creatorUsername}
                      </p>
                      <p className="text-[0.65rem] text-white/80 line-clamp-1">{reel.caption}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
