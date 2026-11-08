import { useState, useRef, type ChangeEvent } from "react";
import { Camera, Upload, X, Sparkles, Send, Loader2, Smile, Type } from "lucide-react";
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

const STORY_STICKERS = ["🌹", "✨", "🌙", "🍷", "🖤", "🥀", "💖", "🔥"];

const PRESET_STORIES = [
  {
    name: "Rose Greenhouse Sunrise",
    url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1080&auto=format&fit=crop&q=85",
    type: "image" as const,
  },
  {
    name: "Evening Bloom Atmosphere",
    url: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=1080&auto=format&fit=crop&q=85",
    type: "image" as const,
  },
];

export function StoryComposerModal({
  open,
  onOpenChange,
  me,
  onStoryPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me?: Profile | null;
  onStoryPublished?: () => void;
}) {
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    setMediaType(isVideo ? "video" : "image");

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setMediaUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handlePublish() {
    if (!mediaUrl) {
      toast.error("Please select a photo or video first.");
      return;
    }
    if (!me) {
      toast.error("Please sign in to plant a story.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      addStory(me, {
        mediaUrl,
        mediaType,
        caption: caption.trim() || undefined,
        sticker: selectedSticker ?? undefined,
      });

      setIsSubmitting(false);
      setMediaUrl("");
      setCaption("");
      setSelectedSticker(null);

      toast.success("Story planted in the Rose Garden 🌹", {
        description: "Visible for the next 24 hours to your circle.",
      });

      onStoryPublished?.();
      onOpenChange(false);
    }, 700);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass border-border/80 p-5 max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-border/60 pb-3">
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Plant a 24h Story 🌹
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Moments bloom for 24 hours, then gently fade.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Media Preview or Dropzone */}
          {!mediaUrl ? (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-border/80 hover:border-primary/60 bg-secondary/30 transition-colors cursor-pointer group text-center aspect-[9/14] max-h-72 w-full mx-auto"
              >
                <Upload className="h-10 w-10 text-primary mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-foreground">Pick photo or clip</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP or MP4</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>

              {/* Presets */}
              <div className="rounded-2xl bg-secondary/40 p-3 border border-border/50">
                <p className="text-xs font-semibold text-rose-soft mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" /> Or try botanical photography:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_STORIES.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setMediaUrl(preset.url);
                        setMediaType(preset.type);
                        setCaption(preset.name);
                      }}
                      className="rounded-xl overflow-hidden aspect-video relative group border border-transparent hover:border-primary"
                    >
                      <img src={preset.url} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center p-1 text-center">
                        <span className="text-[0.65rem] text-white font-medium">{preset.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active Preview */}
              <div className="relative aspect-[9/16] max-h-80 w-auto mx-auto rounded-3xl overflow-hidden bg-black shadow-xl border border-white/10">
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
                  <div className="absolute top-4 right-4 text-4xl animate-bounce drop-shadow-md">
                    {selectedSticker}
                  </div>
                )}

                {/* Caption overlay */}
                {caption && (
                  <div className="absolute bottom-4 inset-x-4 p-2.5 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs text-center">
                    {caption}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setMediaUrl("")}
                  className="absolute top-3 left-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Decorative Stickers */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-rose-soft flex items-center gap-1">
                  <Smile className="h-3.5 w-3.5" /> Decorative Rose Charm:
                </label>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {STORY_STICKERS.map((sticker) => (
                    <button
                      key={sticker}
                      type="button"
                      onClick={() =>
                        setSelectedSticker(selectedSticker === sticker ? null : sticker)
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition-transform ${
                        selectedSticker === sticker
                          ? "bg-primary text-white scale-110 shadow-glow"
                          : "bg-secondary/60 hover:scale-105"
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
                  <Type className="h-3.5 w-3.5" /> Overlay Caption:
                </label>
                <Input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a fleeting thought... 🌹"
                  maxLength={100}
                  className="h-9 rounded-xl bg-secondary/50 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
            disabled={!mediaUrl || isSubmitting}
            onClick={handlePublish}
            className="rounded-xl text-xs font-semibold shadow-glow px-5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Planting...
              </>
            ) : (
              "Plant Story 🌹"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
