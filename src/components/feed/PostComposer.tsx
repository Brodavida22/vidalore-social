import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Smile, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/profile/UserAvatar";
import type { Profile } from "@/services/profiles";
import {
  createPost,
  deletePost,
  postsKeys,
  POST_LIMITS,
  POST_MEDIA_ACCEPT,
  detectMediaInfo,
  validatePostDraft,
} from "@/services/posts";
import { VideoUploadProgressCard } from "@/components/media/VideoUploadProgressCard";
import { formatBytes, type VideoUploadProgress } from "@/lib/videoUpload";

const POST_TAGS = ["Design", "Technology", "Photography", "Architecture", "Community"];

const POST_STATUSES = [
  "Deep Work",
  "Creative Mode",
  "Design Exploration",
  "Reflecting",
  "Building",
];

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
  type: "image" | "video";
}

export function PostComposer({ me, onPostCreated }: { me: Profile; onPostCreated?: () => void }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [showMoods, setShowMoods] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<VideoUploadProgress | null>(null);

  // Retain draft postId across retries to prevent duplicate database rows
  const draftPostIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => {
        if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      });
    };
  }, [pendingFiles]);

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      if (selectedTags.length >= POST_LIMITS.maxTags) {
        toast.info(`Up to ${POST_LIMITS.maxTags} tags per post`);
        return;
      }
      setSelectedTags([...selectedTags, tag]);
    }
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const incoming = Array.from(fileList);
    if (pendingFiles.length + incoming.length > POST_LIMITS.maxMedia) {
      toast.error(`Maximum ${POST_LIMITS.maxMedia} media attachments per post`);
      return;
    }

    const additions: PendingFile[] = [];
    for (const file of incoming) {
      const mimeInfo = detectMediaInfo(file);
      if (!mimeInfo) {
        toast.error(`File "${file.name}" is not a supported image or video.`);
        continue;
      }
      if (file.size > POST_LIMITS.maxFileBytes) {
        toast.error(`File "${file.name}" exceeds the 50 MB limit.`);
        continue;
      }
      additions.push({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        type: mimeInfo.type,
      });
    }

    if (additions.length > 0) {
      setPendingFiles((prev) => [...prev, ...additions]);
      setUploadProgress(null);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeMedia(id: string) {
    setPendingFiles((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleDiscard() {
    if (draftPostIdRef.current) {
      try {
        await deletePost(draftPostIdRef.current);
      } catch (err) {
        console.warn("Could not delete incomplete post draft on discard:", err);
      }
      draftPostIdRef.current = null;
    }
    setUploadProgress(null);
  }

  async function handleSubmit() {
    const errorMsg = validatePostDraft({
      content,
      files: pendingFiles.map((p) => ({ type: p.file.type, size: p.file.size })),
      tags: selectedTags,
    });
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setIsSubmitting(true);
    const totalBytes = pendingFiles.reduce((sum, p) => sum + p.file.size, 0);

    if (pendingFiles.length > 0) {
      setUploadProgress({
        stage: "preparing",
        percent: 0,
        bytesUploaded: 0,
        bytesTotal: totalBytes,
        formattedUploaded: "0 MB",
        formattedTotal: formatBytes(totalBytes),
      });
    }

    try {
      await createPost({
        content: content.trim(),
        files: pendingFiles.map((p) => p.file),
        tags: selectedTags,
        mood: selectedMood || undefined,
        location: me.location || undefined,
        existingPostId: draftPostIdRef.current ?? undefined,
        onProgress: (prog) => {
          setUploadProgress(prog);
        },
      });

      if (pendingFiles.length > 0) {
        // Genuine success confirmation
        setUploadProgress({
          stage: "success",
          percent: 100,
          bytesUploaded: totalBytes,
          bytesTotal: totalBytes,
          formattedUploaded: formatBytes(totalBytes),
          formattedTotal: formatBytes(totalBytes),
        });

        // Brief delay for user visual confirmation
        await new Promise((resolve) => setTimeout(resolve, 700));
      }

      // Cleanup preview URLs
      pendingFiles.forEach((p) => {
        if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      });

      draftPostIdRef.current = null;
      setContent("");
      setSelectedTags([]);
      setSelectedMood(null);
      setPendingFiles([]);
      setShowMoods(false);
      setUploadProgress(null);

      toast.success("Post published successfully");

      // Invalidate posts query cache so all feeds update immediately
      await queryClient.invalidateQueries({ queryKey: postsKeys.all });
      onPostCreated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't publish your post.";
      const postErr = err as Error & { postId?: string };

      // Preserve existing postId for retry without duplicate posts
      if (postErr.postId) {
        draftPostIdRef.current = postErr.postId;
      }

      setUploadProgress((prev) => ({
        stage: "error",
        percent: prev?.percent || 0,
        bytesUploaded: prev?.bytesUploaded || 0,
        bytesTotal: prev?.bytesTotal || totalBytes,
        formattedUploaded: prev?.formattedUploaded || "0 MB",
        formattedTotal: prev?.formattedTotal || formatBytes(totalBytes),
        errorMessage: msg,
      }));

      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const firstVideo = pendingFiles.find((p) => p.type === "video");

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
                  disabled={isSubmitting}
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
            maxLength={POST_LIMITS.maxContent}
            disabled={isSubmitting}
            className="mt-2 w-full resize-none border-none bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0 leading-relaxed disabled:opacity-60"
          />

          {/* Media preview grid */}
          {pendingFiles.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {pendingFiles.map((m) => (
                <div
                  key={m.id}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-secondary border border-border"
                >
                  {m.type === "video" ? (
                    <video src={m.previewUrl} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  {!isSubmitting && (
                    <button
                      type="button"
                      onClick={() => removeMedia(m.id)}
                      aria-label="Remove media"
                      className="absolute top-2 right-2 rounded-lg bg-black/70 p-1 text-white hover:bg-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {m.type === "video" && (
                    <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[0.65rem] text-white font-medium">
                      VIDEO
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Accurate Progress Card for Video / Media Uploads */}
          {uploadProgress && (
            <div className="mt-3">
              <VideoUploadProgressCard
                progress={uploadProgress}
                videoPreviewUrl={firstVideo?.previewUrl ?? pendingFiles[0]?.previewUrl}
                videoName={firstVideo?.file.name ?? pendingFiles[0]?.file.name}
                onRetry={handleSubmit}
                onCancel={handleDiscard}
              />
            </div>
          )}

          {/* Tag pills */}
          {!uploadProgress && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {POST_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
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
          )}

          {/* Mood selection tray */}
          {showMoods && !uploadProgress && (
            <div className="mt-3 flex flex-wrap gap-1.5 rounded-xl bg-secondary p-2.5 border border-border">
              {POST_STATUSES.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setSelectedMood(mood);
                    setShowMoods(false);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
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
                accept={POST_MEDIA_ACCEPT}
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
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
                disabled={isSubmitting}
                onClick={() => setShowMoods(!showMoods)}
                className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Smile className="h-3.5 w-3.5 mr-1" />
                Status
              </Button>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {content.length > 0 && (
                <span className="text-[0.7rem] text-muted-foreground">
                  {content.length}/{POST_LIMITS.maxContent}
                </span>
              )}

              <Button
                type="button"
                size="sm"
                disabled={
                  isSubmitting ||
                  uploadProgress?.stage === "error" ||
                  (!content.trim() && pendingFiles.length === 0)
                }
                onClick={handleSubmit}
                className="rounded-lg px-4 text-xs font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Publish
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
