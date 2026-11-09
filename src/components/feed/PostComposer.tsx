import { useState, useRef, type ChangeEvent } from "react";
import { Image as ImageIcon, Smile, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/profile/UserAvatar";
import type { Profile } from "@/services/profiles";
import { createPost, type PostMedia } from "@/services/social";

const POST_TAGS = ["Design", "Technology", "Photography", "Architecture", "Community"];

const POST_STATUSES = [
  "Deep Work",
  "Creative Mode",
  "Design Exploration",
  "Reflecting",
  "Building",
];

export function PostComposer({ me, onPostCreated }: { me: Profile; onPostCreated?: () => void }) {
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [showMoods, setShowMoods] = useState(false);
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

      toast.success("Post published successfully (+10 points)");

      onPostCreated?.();
    } catch {
      toast.error("Couldn't publish your post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="relative rounded-xl p-4 sm:p-5 border border-border bg-card shadow-sm">
      <div className="flex items-start gap-3">
        <UserAvatar profile={me} className="h-10 w-10 ring-1 ring-border shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {me.display_name || `@${me.username}`}
            </span>
            {selectedMood && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#E91E63]/10 px-2.5 py-0.5 text-xs text-[#E91E63] font-medium">
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
            placeholder="Share your thoughts or work..."
            rows={content.length > 80 ? 3 : 2}
            maxLength={600}
            className="mt-2 w-full resize-none border-none bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0 leading-relaxed"
          />

          {/* Media preview grid */}
          {mediaList.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {mediaList.map((m) => (
                <div
                  key={m.id}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-secondary border border-border"
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
                    className="absolute top-2 right-2 rounded-lg bg-black/70 p-1 text-white hover:bg-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {m.type === "video" && (
                    <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[0.65rem] text-white font-medium">
                      VIDEO
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tag pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {POST_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#E91E63] text-white"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>

          {/* Mood selection tray */}
          {showMoods && (
            <div className="mt-3 flex flex-wrap gap-1.5 rounded-xl bg-secondary p-2.5 border border-border">
              {POST_STATUSES.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => {
                    setSelectedMood(mood);
                    setShowMoods(false);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                    selectedMood === mood
                      ? "bg-[#E91E63] text-white font-medium"
                      : "bg-card hover:bg-background text-foreground border border-border"
                  }`}
                >
                  {mood}
                </button>
              ))}
            </div>
          )}

          {/* Footer toolbar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
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
                className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ImageIcon className="h-3.5 w-3.5 mr-1 text-[#E91E63]" />
                Media
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowMoods(!showMoods)}
                className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Smile className="h-3.5 w-3.5 mr-1" />
                Status
              </Button>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {content.length > 0 && (
                <span className="text-[0.7rem] text-muted-foreground">{content.length}/600</span>
              )}

              <Button
                type="button"
                size="sm"
                disabled={isSubmitting || (!content.trim() && mediaList.length === 0)}
                onClick={handleSubmit}
                className="rounded-lg px-4 text-xs font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm"
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
