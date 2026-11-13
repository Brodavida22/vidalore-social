import { useState, useRef, type ChangeEvent } from "react";
import {
  Video,
  UploadCloud,
  X,
  Play,
  Pause,
  Loader2,
  Music,
  CheckCircle2,
  Zap,
  AlertCircle,
} from "lucide-react";
import { toast } from "@/lib/toast";
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
import { compressVideoFile } from "@/lib/videoUpload";
import type { Profile } from "@/services/profiles";

type ReelUploadStage = "idle" | "compressing" | "uploading" | "publishing";

export function VideoUploadModal({
  open,
  onOpenChange,
  me,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me?: Profile | null | undefined;
  onUploaded?: () => void;
}) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [detectedFormatNote, setDetectedFormatNote] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [audioTitle, setAudioTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<ReelUploadStage>("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [savingsInfo, setSavingsInfo] = useState<{
    originalMB: number;
    compressedMB: number;
    savedPercent: number;
  } | null>(null);
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
    setSavingsInfo(null);
    setUploadStage("idle");
    setPublishError(null);

    // Format hint
    const lowerName = file.name.toLowerCase();
    if (file.type.includes("quicktime") || lowerName.endsWith(".mov")) {
      setDetectedFormatNote("QuickTime MOV format — will be converted to standard H.264 MP4.");
    } else {
      setDetectedFormatNote("Will be optimized to 720p 30fps H.264 MP4 for mobile streaming.");
    }

    const objectUrl = URL.createObjectURL(file);
    setVideoUrl(objectUrl);
  }

  function removeSelectedVideo() {
    if (videoFile && videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl("");
    setDetectedFormatNote(null);
    setSavingsInfo(null);
    setUploadStage("idle");
    setPublishError(null);
    setIsPlaying(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePublish() {
    if (!videoUrl || !videoFile) {
      toast.error("Please select a video first.");
      return;
    }
    if (!me) {
      toast.error("Please sign in to publish reels.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStage("compressing");
    setPublishError(null);

    try {
      // 1. Convert video to H.264 MP4 using WebCodecs via mediabunny
      const comp = await compressVideoFile(videoFile, (p) => {
        setUploadProgress(Math.round(p * 0.45));
      });

      if (comp.compressed && comp.compressedBytes < comp.originalBytes) {
        const originalMB = comp.originalBytes / (1024 * 1024);
        const compressedMB = comp.compressedBytes / (1024 * 1024);
        const savedPercent = Math.round((1 - comp.compressedBytes / comp.originalBytes) * 100);
        setSavingsInfo({
          originalMB,
          compressedMB,
          savedPercent,
        });
      }

      // 2. Upload converted file via resumable TUS upload
      setUploadStage("uploading");

      await addReel(me, {
        videoUrl,
        videoFile: comp.file,
        caption: caption.trim() || "Moments in the Rose Garden 🌹",
        audioTitle: audioTitle.trim() || undefined,
        tags: ["RoseGarden", "VidaloreReels"],
        onUploadProgress: (p) => {
          setUploadProgress(p);
          if (p >= 95) {
            setUploadStage("publishing");
          }
        },
      });

      // 3. Complete
      setUploadStage("publishing");
      setUploadProgress(100);

      removeSelectedVideo();
      setCaption("");
      setAudioTitle("");
      toast.success("Reel published to the Rose Garden 🌹", {
        description: "Your video is now live in the global reels stream.",
      });
      onUploaded?.();
      onOpenChange(false);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Could not publish reel. Please verify your video format.";
      setPublishError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
      setUploadStage("idle");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass border-border/80 p-5 max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="font-display text-xl flex items-center gap-2 text-foreground">
            <Video className="h-5 w-5 text-[#E91E63]" />
            Upload Reel
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Share vertical video moments. Videos are converted to H.264 MP4 for mobile playback.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Video Preview or Selector */}
          {!videoUrl ? (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-border hover:border-[#E91E63]/60 bg-secondary/30 transition-colors cursor-pointer group text-center"
              >
                <UploadCloud className="h-10 w-10 text-[#E91E63] mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-foreground">Select vertical video</p>
                <p className="text-xs text-muted-foreground mt-1">
                  MP4 (H.264 or Android HEVC), WebM or MOV up to 100 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={handleFileSelect}
                />
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
                  disabled={isUploading}
                  className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-destructive transition-colors disabled:opacity-50"
                  aria-label="Remove video"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Format Detection Hint */}
              {detectedFormatNote && !isUploading && (
                <div className="flex items-center gap-1.5 rounded-lg bg-secondary/60 border border-border px-3 py-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#E91E63] shrink-0" />
                  <span>{detectedFormatNote}</span>
                </div>
              )}

              {/* Caption */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Caption & Hashtags</label>
                <Textarea
                  value={caption}
                  disabled={isUploading}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe your reel... #Vidalore #Style"
                  rows={2}
                  maxLength={300}
                  className="resize-none rounded-xl bg-secondary/50 text-xs border-border"
                />
                <p className="text-[0.65rem] text-right text-muted-foreground">
                  {caption.length}/300
                </p>
              </div>

              {/* Sound/Audio Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Music className="h-3 w-3 text-[#E91E63]" /> Audio Title (optional)
                </label>
                <Input
                  value={audioTitle}
                  disabled={isUploading}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  placeholder="e.g. Original Sound — Vidalore"
                  className="h-9 rounded-xl bg-secondary/50 text-xs border-border"
                />
              </div>

              {/* Compression Savings Pill if available */}
              {savingsInfo && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Zap className="h-3.5 w-3.5 text-emerald-400" />
                    Compressed: {savingsInfo.originalMB.toFixed(1)} MB →{" "}
                    {savingsInfo.compressedMB.toFixed(1)} MB
                  </span>
                  <span className="font-semibold text-emerald-300">
                    -{savingsInfo.savedPercent}%
                  </span>
                </div>
              )}

              {/* Error banner if publishing failed */}
              {publishError && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Upload & Conversion Failed</p>
                    <p className="text-destructive/90 text-[0.7rem] leading-relaxed">
                      {publishError}
                    </p>
                  </div>
                </div>
              )}

              {/* Multi-stage Upload Progress */}
              {isUploading && (
                <div className="space-y-2 rounded-xl border border-border bg-secondary/60 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E91E63]" />
                      {uploadStage === "compressing"
                        ? "Converting video (H.264 / 720p 30fps AAC)..."
                        : uploadStage === "uploading"
                          ? "Uploading via resumable TUS..."
                          : "Finalizing & publishing..."}
                    </span>
                    <span className="text-[#E91E63] font-semibold tabular-nums">
                      {uploadProgress}%
                    </span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-[0.65rem] text-muted-foreground">
                    {uploadStage === "compressing"
                      ? "Transcoding video into MP4/H.264 so it plays on Android Chrome and all mobile browsers."
                      : "Chunked TUS upload ensures reliable delivery even on unstable mobile data."}
                  </p>
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
            disabled={isUploading}
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!videoUrl || isUploading}
            onClick={handlePublish}
            className="rounded-lg text-xs font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white px-5 shadow-sm"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                {uploadStage === "compressing"
                  ? "Converting..."
                  : uploadStage === "uploading"
                    ? "Uploading..."
                    : "Publishing..."}
              </>
            ) : (
              "Publish Reel"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
