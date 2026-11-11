import { useState, useRef, type ChangeEvent } from "react";
import { Camera, Upload, X, Loader2, Smile, Type, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addStory, compressStoryVideo } from "@/services/reelsAndStories";
import type { Profile } from "@/services/profiles";
import { VideoUploadProgressCard } from "@/components/media/VideoUploadProgressCard";
import { formatBytes, type VideoUploadProgress } from "@/lib/videoUpload";

const STORY_STICKERS = ["✨", "🔥", "⚡", "🎯", "💡", "🙌", "🌿", "📷"];
const MAX_STORY_BYTES = 50 * 1024 * 1024;

export function StoryComposerModal({
  open,
  onOpenChange,
  me,
  onStoryPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me?: Profile | null | undefined;
  onStoryPublished?: () => void;
}) {
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<VideoUploadProgress | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function clearMedia() {
    if (isSubmitting) return;

    if (mediaUrl.startsWith("blob:")) {
      URL.revokeObjectURL(mediaUrl);
    }

    setMediaUrl("");
    setMediaFile(null);
    setMediaType("image");
    setUploadProgress(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      toast.error("Choose an image or video file.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_STORY_BYTES) {
      toast.error("Story media is too large", {
        description: `Selected file: ${fileSizeMB.toFixed(2)} MB. Maximum allowed: 50 MB.`,
      });
      e.target.value = "";
      return;
    }

    if (mediaUrl.startsWith("blob:")) {
      URL.revokeObjectURL(mediaUrl);
    }

    setMediaFile(file);
    setMediaType(isVideo ? "video" : "image");
    setMediaUrl(URL.createObjectURL(file));
    setUploadProgress(null);
  }

  async function handlePublish() {
    if (!mediaFile || !mediaUrl) {
      toast.error("Please select a photo or video first.");
      return;
    }

    if (!me) {
      toast.error("Please sign in to post a story.");
      return;
    }

    setIsSubmitting(true);
    const initialBytes = mediaFile.size;

    setUploadProgress({
      stage: "preparing",
      percent: 0,
      bytesUploaded: 0,
      bytesTotal: initialBytes,
      formattedUploaded: "0 MB",
      formattedTotal: formatBytes(initialBytes),
    });

    try {
      let fileToUpload = mediaFile;

      // Safe client-side video compression before uploading.
      if (mediaType === "video") {
        setUploadProgress({
          stage: "compressing",
          percent: 5,
          bytesUploaded: 0,
          bytesTotal: initialBytes,
          formattedUploaded: "0 MB",
          formattedTotal: formatBytes(initialBytes),
        });

        const result = await compressStoryVideo(mediaFile, (value) => {
          setUploadProgress({
            stage: "compressing",
            percent: Math.min(95, Math.max(5, value)),
            bytesUploaded: 0,
            bytesTotal: initialBytes,
            formattedUploaded: "0 MB",
            formattedTotal: formatBytes(initialBytes),
          });
        });

        fileToUpload = result.file;

        if (result.compressed) {
          const originalMB = mediaFile.size / (1024 * 1024);
          const compressedMB = fileToUpload.size / (1024 * 1024);
          const savedPercent = Math.round((1 - fileToUpload.size / mediaFile.size) * 100);

          toast.success("Video optimized", {
            description: `${originalMB.toFixed(1)} MB → ${compressedMB.toFixed(1)} MB (${savedPercent}% smaller).`,
          });
        }
      }

      if (fileToUpload.size > MAX_STORY_BYTES) {
        throw new Error(
          `The video exceeds maximum allowed 50 MB. Size: ${(fileToUpload.size / (1024 * 1024)).toFixed(1)} MB.`,
        );
      }

      const uploadTotal = fileToUpload.size;
      setUploadProgress({
        stage: "uploading",
        percent: 0,
        bytesUploaded: 0,
        bytesTotal: uploadTotal,
        formattedUploaded: "0 MB",
        formattedTotal: formatBytes(uploadTotal),
      });

      await addStory(me, {
        mediaUrl,
        mediaFile: fileToUpload,
        mediaType,
        caption: caption.trim() || undefined,
        sticker: selectedSticker ?? undefined,
        onUploadProgress: (prog) => {
          if (typeof prog === "number") {
            const uploadedBytes = Math.round((prog / 100) * uploadTotal);
            setUploadProgress({
              stage: "uploading",
              percent: Math.min(99, prog),
              bytesUploaded: uploadedBytes,
              bytesTotal: uploadTotal,
              formattedUploaded: formatBytes(uploadedBytes),
              formattedTotal: formatBytes(uploadTotal),
            });
          } else {
            setUploadProgress(prog);
          }
        },
      });

      // Genuine completion
      setUploadProgress({
        stage: "success",
        percent: 100,
        bytesUploaded: uploadTotal,
        bytesTotal: uploadTotal,
        formattedUploaded: formatBytes(uploadTotal),
        formattedTotal: formatBytes(uploadTotal),
      });

      // Brief delay so user sees confirmed success state before closing
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (mediaUrl.startsWith("blob:")) {
        URL.revokeObjectURL(mediaUrl);
      }

      setMediaUrl("");
      setMediaFile(null);
      setMediaType("image");
      setCaption("");
      setSelectedSticker(null);
      setUploadProgress(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast.success("Story posted successfully", {
        description: "Visible for the next 24 hours to your followers.",
      });

      onStoryPublished?.();
      onOpenChange(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Could not publish story.";
      toast.error(errorMsg);

      // Keep user's caption, sticker, and media file so they can retry without losing their work
      setUploadProgress((prev) => ({
        stage: "error",
        percent: prev?.percent || 0,
        bytesUploaded: prev?.bytesUploaded || 0,
        bytesTotal: prev?.bytesTotal || mediaFile.size,
        formattedUploaded: prev?.formattedUploaded || "0 MB",
        formattedTotal: prev?.formattedTotal || formatBytes(mediaFile.size),
        errorMessage: errorMsg,
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSubmitting && !nextOpen) return;
        if (!nextOpen && uploadProgress?.stage === "error") {
          clearMedia();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md bg-card border-border p-5 max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="font-display text-lg font-bold flex items-center gap-2 text-foreground">
            <Camera className="h-5 w-5 text-primary" />
            Post 24h Story
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Stories remain visible for 24 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {!mediaUrl ? (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-border hover:border-[#E91E63] bg-secondary/50 transition-colors cursor-pointer group text-center aspect-[9/14] max-h-72 w-full mx-auto"
              >
                <Upload className="h-8 w-8 text-[#E91E63] mb-2 group-hover:scale-105 transition-transform" />
                <p className="text-xs font-semibold text-foreground">Select photo or clip</p>
                <p className="text-[0.7rem] text-muted-foreground mt-0.5">
                  JPG, PNG, WebP or MP4 · Maximum 50 MB
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFile}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative aspect-[9/16] max-h-80 w-auto mx-auto rounded-xl overflow-hidden bg-black shadow-lg border border-border">
                {mediaType === "video" ? (
                  <video
                    src={mediaUrl}
                    className="h-full w-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
                )}

                {selectedSticker && (
                  <div className="absolute top-4 right-4 text-3xl animate-bounce">
                    {selectedSticker}
                  </div>
                )}

                {caption && (
                  <div className="absolute bottom-4 inset-x-4 p-2.5 rounded-lg bg-black/70 backdrop-blur-sm text-white text-xs text-center font-medium">
                    {caption}
                  </div>
                )}

                {!isSubmitting && (
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="absolute top-3 left-3 rounded-lg bg-black/70 p-1.5 text-white hover:bg-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Real upload progress card with MB / MB breakdown & retry */}
              {uploadProgress && (
                <VideoUploadProgressCard
                  progress={uploadProgress}
                  videoPreviewUrl={mediaType === "video" ? mediaUrl : null}
                  videoName={mediaFile?.name}
                  onRetry={handlePublish}
                  onCancel={clearMedia}
                />
              )}

              {/* Stickers & Caption controls (disabled while submitting) */}
              {!uploadProgress && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Smile className="h-3.5 w-3.5 text-primary" />
                      Add Badge / Emoji:
                    </label>

                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {STORY_STICKERS.map((sticker) => (
                        <button
                          key={sticker}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() =>
                            setSelectedSticker(selectedSticker === sticker ? null : sticker)
                          }
                          className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors disabled:opacity-50 ${
                            selectedSticker === sticker
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "bg-secondary hover:bg-secondary/80 border border-border"
                          }`}
                        >
                          {sticker}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Type className="h-3.5 w-3.5" />
                      Caption:
                    </label>

                    <Input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Add a caption..."
                      maxLength={100}
                      disabled={isSubmitting}
                      className="h-9 rounded-lg bg-secondary text-xs border-border"
                    />
                  </div>

                  {mediaType === "video" && (
                    <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2.5 text-[0.7rem] text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      Resumable TUS upload with client-side video optimization enabled.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-lg text-xs"
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!mediaUrl || isSubmitting || uploadProgress?.stage === "error"}
            onClick={handlePublish}
            className="rounded-lg text-xs font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white px-4 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Processing...
              </>
            ) : (
              "Publish Story"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
