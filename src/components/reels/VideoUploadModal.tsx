import { useState, useRef, type ChangeEvent } from "react";
import { Video, UploadCloud, X, Play, Pause, Loader2, Sparkles, Music } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { addReel } from "@/services/reelsAndStories";
import type { Profile } from "@/services/profiles";

const REEL_PRESET_CLIPS = [
  {
    name: "Night Bloom Conservatory",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    name: "Milan Velvet Editorial",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
];

export function VideoUploadModal({
  open,
  onOpenChange,
  me,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me?: Profile | null;
  onUploaded?: () => void;
}) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [audioTitle, setAudioTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a valid MP4, WebM or MOV video file.");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video file must be smaller than 100 MB.");
      return;
    }

    setVideoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVideoUrl(objectUrl);
  }

  function handleSelectPreset(clip: (typeof REEL_PRESET_CLIPS)[0]) {
    setVideoFile(null);
    setVideoUrl(clip.url);
    if (!caption) setCaption(`Moments from the ${clip.name} 🌹 #RoseGarden #Vidalore`);
    if (!audioTitle) setAudioTitle(`${clip.name} (Original Sound)`);
  }

  function removeSelectedVideo() {
    if (videoFile && videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl("");
    setIsPlaying(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePublish() {
    if (!videoUrl) {
      toast.error("Please select a video first.");
      return;
    }
    if (!me) {
      toast.error("Please sign in to publish reels.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);

    setUploadProgress(20);
    try {
      await addReel(me, {
        videoUrl,
        videoFile: videoFile ?? undefined,
        caption: caption.trim() || "Moments in the Rose Garden 🌹",
        audioTitle: audioTitle.trim() || undefined,
        tags: ["RoseGarden", "VidaloreReels"],
      });
      setUploadProgress(100);
      setIsUploading(false);
      setUploadProgress(0);
      removeSelectedVideo();
      setCaption("");
      setAudioTitle("");
      toast.success("Reel published to the Rose Garden 🌹", {
        description: "Your video is now live in the global reels stream.",
      });
      onUploaded?.();
      onOpenChange(false);
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
      toast.error(error instanceof Error ? error.message : "Could not publish reel.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass border-border/80 p-5 max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-border/60 pb-3">
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Upload Reel 🌹
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Share vertical video moments with the VIDALORE community.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Video Preview or Selector */}
          {!videoUrl ? (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-border/80 hover:border-primary/60 bg-secondary/30 transition-colors cursor-pointer group text-center"
              >
                <UploadCloud className="h-10 w-10 text-primary mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-foreground">Select vertical video</p>
                <p className="text-xs text-muted-foreground mt-1">MP4, WebM or MOV up to 100 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Presets */}
              <div className="rounded-2xl bg-secondary/40 p-3 border border-border/50">
                <p className="text-xs font-semibold text-rose-soft mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" /> Or try Rose Garden studio clips:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {REEL_PRESET_CLIPS.map((clip) => (
                    <button
                      key={clip.name}
                      type="button"
                      onClick={() => handleSelectPreset(clip)}
                      className="rounded-xl bg-background/60 p-2 text-left hover:ring-1 hover:ring-primary transition-all"
                    >
                      <p className="text-xs font-medium truncate text-foreground">{clip.name}</p>
                      <p className="text-[0.65rem] text-rose-soft">High-res sample</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active Video Preview Player */}
              <div className="relative aspect-[9/16] max-h-72 w-auto mx-auto rounded-2xl overflow-hidden bg-black shadow-lg">
                <video
                  ref={videoPreviewRef}
                  src={videoUrl}
                  className="h-full w-full object-cover"
                  loop
                  playsInline
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = videoPreviewRef.current;
                    if (!v) return;
                    if (v.paused) {
                      v.play();
                      setIsPlaying(true);
                    } else {
                      v.pause();
                      setIsPlaying(false);
                    }
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md">
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-0.5" />
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={removeSelectedVideo}
                  className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-destructive transition-colors"
                  aria-label="Remove video"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Caption */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-rose-soft">Caption & Hashtags</label>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe your reel... #RoseGarden #Aesthetic"
                  rows={2}
                  maxLength={300}
                  className="resize-none rounded-xl bg-secondary/50 text-xs"
                />
                <p className="text-[0.65rem] text-right text-muted-foreground">
                  {caption.length}/300
                </p>
              </div>

              {/* Sound/Audio Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Music className="h-3 w-3 text-primary" /> Audio Title (optional)
                </label>
                <Input
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  placeholder="e.g. Original Sound — Vidalore Night"
                  className="h-9 rounded-xl bg-secondary/50 text-xs"
                />
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-1.5 py-1">
                  <div className="flex justify-between text-xs text-rose-soft">
                    <span>Uploading & verifying media...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="rose"
            size="sm"
            disabled={!videoUrl || isUploading}
            onClick={handlePublish}
            className="rounded-xl text-xs font-semibold shadow-glow px-5"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Publishing...
              </>
            ) : (
              "Publish Reel 🌹"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
