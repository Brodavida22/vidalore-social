import { useState, useRef, type ChangeEvent } from "react";
import { Camera, Upload, X, Loader2, Smile, Type } from "lucide-react";
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
import { addStory } from "@/services/reelsAndStories";
import type { Profile } from "@/services/profiles";

const STORY_STICKERS = ["✨", "🔥", "⚡", "🎯", "💡", "🙌", "🌿", "📷"];

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
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

        const fileSizeMB = file.size / (1024 * 1024);

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Story video is too large", {
        description: `Your selected file is ${fileSizeMB.toFixed(2)} MB. Maximum allowed is 25 MB.`,
      });
      e.target.value = "";
      return;
    }
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) {
      toast.error("Choose an image or video file.");
      return;
    }
    setMediaFile(file);
    setMediaType(isVideo ? "video" : "image");

    setMediaUrl(URL.createObjectURL(file));
  }

  async function handlePublish() {
    if (!mediaUrl) {
      toast.error("Please select a photo or video first.");
      return;
    }
    if (!me) {
      toast.error("Please sign in to post a story.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addStory(me, {
        mediaUrl,
        mediaFile: mediaFile ?? undefined,
        mediaType,
        caption: caption.trim() || undefined,
        sticker: selectedSticker ?? undefined,
      });
      if (mediaFile && mediaUrl.startsWith("blob:")) URL.revokeObjectURL(mediaUrl);
      setIsSubmitting(false);
      setMediaUrl("");
      setMediaFile(null);
      setCaption("");
      setSelectedSticker(null);
      toast.success("Story posted successfully", {
        description: "Visible for the next 24 hours to your followers.",
      });
      onStoryPublished?.();
      onOpenChange(false);
    } catch (error) {
      setIsSubmitting(false);
      toast.error(error instanceof Error ? error.message : "Could not publish story.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {/* Media Preview or Dropzone */}
          {!mediaUrl ? (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-border hover:border-[#E91E63] bg-secondary/50 transition-colors cursor-pointer group text-center aspect-[9/14] max-h-72 w-full mx-auto"
              >
                <Upload className="h-8 w-8 text-[#E91E63] mb-2 group-hover:scale-105 transition-transform" />
                <p className="text-xs font-semibold text-foreground">Select photo or clip</p>
                <p className="text-[0.7rem] text-muted-foreground mt-0.5">JPG, PNG, WebP or MP4</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active Preview */}
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

                {/* Sticker badge */}
                {selectedSticker && (
                  <div className="absolute top-4 right-4 text-3xl animate-bounce">
                    {selectedSticker}
                  </div>
                )}

                {/* Caption overlay */}
                {caption && (
                  <div className="absolute bottom-4 inset-x-4 p-2.5 rounded-lg bg-black/70 backdrop-blur-sm text-white text-xs text-center font-medium">
                    {caption}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (mediaUrl.startsWith("blob:")) URL.revokeObjectURL(mediaUrl);
                    setMediaUrl("");
                    setMediaFile(null);
                  }}
                  className="absolute top-3 left-3 rounded-lg bg-black/70 p-1.5 text-white hover:bg-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Decorative Stickers */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Smile className="h-3.5 w-3.5 text-primary" /> Add Badge / Emoji:
                </label>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {STORY_STICKERS.map((sticker) => (
                    <button
                      key={sticker}
                      type="button"
                      onClick={() =>
                        setSelectedSticker(selectedSticker === sticker ? null : sticker)
                      }
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors ${
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

              {/* Caption text */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Type className="h-3.5 w-3.5" /> Caption:
                </label>
                <Input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  maxLength={100}
                  className="h-9 rounded-lg bg-secondary text-xs border-border"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-lg text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!mediaUrl || isSubmitting}
            onClick={handlePublish}
            className="rounded-lg text-xs font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white px-4 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Publishing...
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
