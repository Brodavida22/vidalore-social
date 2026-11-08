import { useState, useRef, type ChangeEvent } from "react";
import { Image as ImageIcon, Smile, Sparkles, X, Loader2, Send, Video, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/profile/UserAvatar";
import type { Profile } from "@/services/profiles";
import { createPost, type PostMedia } from "@/services/social";

const GARDEN_TAGS = ["RoseGarden", "VelvetHours", "BloomClub", "MidnightRoses", "VidaloreStyle"];

const GARDEN_MOODS = [
  "🌹 Feeling Enchanted",
  "✨ Radiant",
  "🌙 Velvet Night",
  "🍷 Elegant",
  "🖤 Mystique",
];

const PRESET_PHOTOS = [
  {
    url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=85",
    caption: "Deep crimson bloom",
  },
  {
    url: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=1200&auto=format&fit=crop&q=85",
    caption: "Velvet roses and morning mist",
  },
  {
    url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1200&auto=format&fit=crop&q=85",
    caption: "Rose petals under candlelight",
  },
];

export function PostComposer({ me, onPostCreated }: { me: Profile; onPostCreated?: () => void }) {
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [showMoods, setShowMoods] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [mediaList, setMediaList] = useState<PostMedia[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      if (selectedTags.length >= 3) {
        toast.info("Up to 3 tags per post");
        return;
      }
      setSelectedTags([...selectedTags, tag]);
    }
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (mediaList.length + files.length > 4) {
      toast.error("Maximum 4 media attachments per post");
      return;
    }

    Array.from(files).forEach((file) => {
      const isVideo = file.type.startsWith("video/");
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setMediaList((prev) => [
            ...prev,
            {
              id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              type: isVideo ? "video" : "image",
              url: reader.result as string,
              caption: file.name,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addPresetPhoto(preset: (typeof PRESET_PHOTOS)[0]) {
    if (mediaList.length >= 4) {
      toast.error("Maximum 4 media attachments per post");
      return;
    }
    setMediaList((prev) => [
      ...prev,
      {
        id: `preset-${Date.now()}`,
        type: "image",
        url: preset.url,
        caption: preset.caption,
      },
    ]);
    setShowPresets(false);
  }

  function removeMedia(id: string) {
    setMediaList(mediaList.filter((m) => m.id !== id));
  }

  async function handleSubmit() {
    if (!content.trim() && mediaList.length === 0) {
      toast.error("Please write something or attach a photo before posting.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createPost(me, {
        content: content.trim(),
        media: mediaList,
        tags: selectedTags,
        mood: selectedMood ?? undefined,
      });

      setContent("");
      setSelectedTags([]);
      setSelectedMood(null);
      setMediaList([]);
      setShowMoods(false);
      setShowPresets(false);

      toast.success("Moment planted in the Rose Garden 🌹 +10 VIDA POINTS", {
        description: "Your post is now blooming in the public feed.",
      });

      onPostCreated?.();
    } catch {
      toast.error("Couldn't publish your post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="glass relative overflow-hidden rounded-3xl p-4 sm:p-5 shadow-card transition-all">
      <div className="flex items-start gap-3">
        <UserAvatar
          profile={me}
          className="h-10 w-10 sm:h-11 sm:w-11 ring-2 ring-primary/40 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {me.display_name || `@${me.username}`}
            </span>
            {selectedMood && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-0.5 text-xs text-rose-soft">
                {selectedMood}
                <button
                  type="button"
                  onClick={() => setSelectedMood(null)}
                  className="hover:text-foreground ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's blooming in your mind... 🌹"
            rows={content.length > 80 ? 3 : 2}
            maxLength={600}
            className="mt-2 w-full resize-none border-none bg-transparent p-0 text-base placeholder:text-muted-foreground focus-visible:ring-0 leading-relaxed"
          />

          {/* Media preview grid */}
          {mediaList.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {mediaList.map((m) => (
                <div
                  key={m.id}
                  className="relative group aspect-square rounded-2xl overflow-hidden bg-black/40"
                >
                  {m.type === "video" ? (
                    <video src={m.url} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(m.id)}
                    aria-label="Remove media"
                    className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {m.type === "video" && (
                    <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.65rem] text-rose-soft font-semibold">
                      VIDEO
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tag pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {GARDEN_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>

          {/* Preset Rose Photos Dropdown/Picker */}
          {showPresets && (
            <div className="mt-3 rounded-2xl bg-secondary/70 p-3 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-rose-soft">
                  Rose Garden Photography:
                </span>
                <button
                  type="button"
                  onClick={() => setShowPresets(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_PHOTOS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addPresetPhoto(preset)}
                    className="relative group rounded-xl overflow-hidden aspect-video border border-transparent hover:border-primary transition-all"
                  >
                    <img src={preset.url} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mood selection tray */}
          {showMoods && (
            <div className="mt-3 flex flex-wrap gap-1.5 rounded-2xl bg-secondary/50 p-2.5 border border-border">
              {GARDEN_MOODS.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => {
                    setSelectedMood(mood);
                    setShowMoods(false);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs transition-all ${
                    selectedMood === mood
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-background/80 hover:bg-background text-foreground"
                  }`}
                >
                  {mood}
                </button>
              ))}
            </div>
          )}

          {/* Footer toolbar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
            <div className="flex items-center gap-1 sm:gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/webm"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 rounded-full px-2.5 text-xs text-rose-soft hover:bg-secondary hover:text-foreground"
              >
                <ImageIcon className="h-4 w-4 mr-1 text-primary" />
                Photo / Video
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPresets(!showPresets)}
                className="h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                Rose Art
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowMoods(!showMoods)}
                className="h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Smile className="h-3.5 w-3.5 mr-1" />
                Garden Vibe
              </Button>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {content.length > 0 && (
                <span className="text-[0.7rem] text-muted-foreground">{content.length}/600</span>
              )}

              <Button
                type="button"
                variant="rose"
                size="sm"
                disabled={isSubmitting || (!content.trim() && mediaList.length === 0)}
                onClick={handleSubmit}
                className="rounded-full px-4 text-xs font-semibold shadow-glow"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1" />
                )}
                Publish
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
