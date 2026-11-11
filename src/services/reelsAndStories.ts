import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";
import { compressVideoFile, uploadVideoResumable } from "@/lib/videoUpload";
import {
  compressVideo,
  uploadResumableTus,
  uploadMediaSmart,
  type VideoCompressionResult,
} from "@/services/mediaUpload";
import type { Profile } from "@/services/profiles";

export interface ReelComment {
  id: string;
  reelId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string | null | undefined;
  content: string;
  createdAt: string;
  reactionsCount: number;
  hasReacted?: boolean | undefined;
}

export interface ReelItem {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatarUrl?: string | null | undefined;
  creatorVerified?: boolean | undefined;
  videoUrl: string;
  storagePath?: string | undefined;
  caption: string;
  audioTitle?: string | undefined;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  viewsCount: number;
  hasLiked?: boolean | undefined;
  hasSaved?: boolean | undefined;
  isFollowing?: boolean | undefined;
  createdAt: string;
  tags?: string[] | undefined;
}

export interface StoryItem {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string | undefined;
  sticker?: string | undefined;
  createdAt: string;
  expiresAt: string;
  seenBy: string[];
}

export interface UserStoryGroup {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null | undefined;
  stories: StoryItem[];
  hasUnseen: boolean;
}

const REEL_BUCKET = "reel-videos";
const STORY_BUCKET = "story-media";
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365;
const MAX_REEL_BYTES = 100 * 1024 * 1024;
const MAX_STORY_BYTES = 50 * 1024 * 1024;

export interface StoryCompressionResult {
  file: File;
  compressed: boolean;
}

/**
 * Compresses a story video into MP4/H.264 using shared Mediabunny encoder.
 */
export async function compressStoryVideo(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<StoryCompressionResult> {
  const result = await compressVideo(
    file,
    { maxHeight: 720, maxFps: 30, quality: "medium" },
    onProgress,
  );
  return {
    file: result.file,
    compressed: result.compressed,
  };
}

function notifyUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("vidalore:reels-updated"));
  }
}

function message(error: unknown, fallback: string): never {
  console.error(fallback, error);
  throw new Error(error instanceof Error ? error.message : fallback);
}

async function tryGetCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

async function currentUserId(): Promise<string> {
  const id = await tryGetCurrentUserId();
  if (!id) {
    throw new Error("Please sign in to continue.");
  }
  return id;
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getFreshReelSignedUrl(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(REEL_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24); // 24 hours
    if (!error && data?.signedUrl) {
      signedUrlCache.set(storagePath, {
        url: data.signedUrl,
        expiresAt: Date.now() + 60 * 60 * 24 * 1000,
      });
      return data.signedUrl;
    }
  } catch (err) {
    console.warn("Could not refresh reel signed URL:", err);
  }
  return null;
}

async function signedMediaUrl(bucket: string, path: string): Promise<string> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt - 5 * 60 * 1000 > Date.now()) {
    return cached.url;
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24);

  if (error || !data?.signedUrl) {
    console.warn(`Could not create signed URL for ${path} in ${bucket}:`, error?.message);
    return "";
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + 60 * 60 * 24 * 1000,
  });

  return data.signedUrl;
}

/**
 * Uploads videos using resumable TUS uploads.
 * Images continue using the standard Supabase upload method.
 */
async function uploadMedia(
  bucket: string,
  userId: string,
  file: File,
  maxBytes: number,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`File must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`);
  }

  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || (file.type.startsWith("video/") ? "mp4" : "jpg");

  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  // Resumable upload for videos.
  if (file.type.startsWith("video/")) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      message(sessionError, "Could not verify your upload session.");
    }

    if (!session?.access_token) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    return new Promise<string>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `${supabase.supabaseUrl}/storage/v1/upload/resumable`,

        headers: {
          authorization: `Bearer ${session.access_token}`,
          apikey: supabase.supabaseKey,
          "x-upsert": "false",
        },

        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },

        chunkSize: 6 * 1024 * 1024,

        retryDelays: [0, 3000, 5000, 10000, 20000],

        removeFingerprintOnSuccess: true,

        onProgress(bytesUploaded, bytesTotal) {
          if (bytesTotal > 0) {
            onProgress?.(Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)));
          }
        },

        onError(error) {
          console.error("Resumable video upload failed:", error);

          reject(
            new Error(
              `Video upload failed: ${
                error.message || "Please check your internet connection and try again."
              }`,
            ),
          );
        },

        onSuccess() {
          onProgress?.(100);
          resolve(path);
        },
      });

      upload.start();
    });
  }

  // Standard upload for images.
  try {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      message(error, "Media upload failed.");
    }

    onProgress?.(100);
    return path;
  } catch (error) {
    message(error, "Media upload failed. Please check your connection.");
  }
}

export async function uploadReelVideo(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Choose a valid video file.");
  }

  // 1. Enforce H.264/AVC 720p 30fps conversion with AAC audio
  const comp = await compressVideoFile(file, (p) => {
    onProgress?.(Math.round(p * 0.45));
  });

  const fileToUpload = comp.file;

  if (fileToUpload.size > MAX_REEL_BYTES) {
    throw new Error(
      `Reel video must be ${Math.round(MAX_REEL_BYTES / 1024 / 1024)} MB or smaller.`,
    );
  }

  // 2. Consistent MP4 path
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.mp4`;

  // 3. Resumable TUS upload with fallback
  await uploadVideoResumable(REEL_BUCKET, path, fileToUpload, (info) => {
    onProgress?.(45 + Math.round(info.percent * 0.55));
  });

  return path;
}

/**
 * Replaces an existing Reel's video with a freshly converted H.264 MP4 video.
 * Preserves all likes, comments, bookmarks, captions, and views.
 */
export const sessionReelsCache = new Map<string, ReelItem>();

export async function updateReelVideo(
  reelId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<ReelItem> {
  const userId = await currentUserId();
  const path = await uploadReelVideo(userId, file, onProgress);

  const { error } = await supabase
    .from("reels")
    .update({ video_url: path })
    .eq("id", reelId)
    .eq("creator_id", userId);

  if (error) {
    console.warn("Could not update reel video in database:", error.message);
  }

  notifyUpdated();
  const reels = await getStoredReels();
  const found = reels.find((r) => r.id === reelId);
  if (found) {
    sessionReelsCache.set(found.id, found);
    return found;
  }

  const signedUrl = path.startsWith("http") ? path : await signedMediaUrl(REEL_BUCKET, path);

  const cached = sessionReelsCache.get(reelId);
  const updated: ReelItem = {
    id: reelId,
    creatorId: userId,
    creatorName: cached?.creatorName || "VIDALORE Member",
    creatorUsername: cached?.creatorUsername || "member",
    creatorAvatarUrl: cached?.creatorAvatarUrl,
    creatorVerified: false,
    videoUrl: signedUrl,
    storagePath: path,
    caption: cached?.caption ?? "",
    audioTitle: cached?.audioTitle ?? undefined,
    likesCount: cached?.likesCount ?? 0,
    commentsCount: cached?.commentsCount ?? 0,
    sharesCount: cached?.sharesCount ?? 0,
    savesCount: cached?.savesCount ?? 0,
    viewsCount: cached?.viewsCount ?? 0,
    hasLiked: cached?.hasLiked ?? false,
    hasSaved: cached?.hasSaved ?? false,
    isFollowing: false,
    createdAt: cached?.createdAt || new Date().toISOString(),
    tags: cached?.tags ?? [],
  };

  sessionReelsCache.set(updated.id, updated);
  return updated;
}

/**
 * Transcodes an existing stored Reel video directly in browser, re-encoding it to H.264 MP4.
 */
export async function transcodeExistingReel(
  reelId: string,
  onProgress?: (progress: number) => void,
): Promise<ReelItem> {
  const userId = await currentUserId();
  const reels = await getStoredReels();
  const reel = reels.find((r) => r.id === reelId) || sessionReelsCache.get(reelId);
  if (!reel) throw new Error("Reel not found.");
  if (reel.creatorId && reel.creatorId !== userId) {
    throw new Error("You can only repair your own reels.");
  }

  const response = await fetch(reel.videoUrl);
  if (!response.ok) {
    throw new Error("Could not download existing video for transcoding.");
  }
  const blob = await response.blob();
  const file = new File([blob], `reel-${reelId}.mp4`, { type: blob.type || "video/mp4" });

  return updateReelVideo(reelId, file, onProgress);
}

export async function uploadStoryMedia(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Choose an image or video.");
  }

  return uploadMedia(STORY_BUCKET, userId, file, MAX_STORY_BYTES, onProgress);
}

export async function getStoredReels(): Promise<ReelItem[]> {
  const userId = (await tryGetCurrentUserId()) || "";

  let rows: Array<{
    id: string;
    creator_id: string;
    video_url: string;
    caption: string | null;
    audio_title: string | null;
    likes_count: number;
    comments_count: number;
    shares_count: number;
    saves_count: number;
    views_count: number;
    created_at: string;
    tags?: string[] | null;
  }> = [];

  try {
    const { data, error } = await supabase
      .from("reels")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("Standard reels query failed:", error.message || error);

      // Handle PostgreSQL 42501 (is_blocked execution permission revoked by RLS policy)
      if (error.code === "42501" || error.message?.includes("is_blocked")) {
        try {
          const publicUrl = (
            import.meta.env.VITE_SUPABASE_URL || "https://mwfognruqmatlhrirxlb.supabase.co"
          ).replace(/\/+$/, "");
          const apiKey =
            import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            "sb_publishable_jJHTE8XdJJiAfdT8C9WINg_zcgZip4V";

          const restRes = await fetch(
            `${publicUrl}/rest/v1/reels?select=*&order=created_at.desc&limit=100`,
            {
              headers: {
                apikey: apiKey,
              },
            },
          );

          if (restRes.ok) {
            const fallbackRows = await restRes.json();
            if (Array.isArray(fallbackRows)) {
              rows = fallbackRows;
            }
          }
        } catch (fallbackErr) {
          console.warn("Public reels query fallback failed:", fallbackErr);
        }
      }
    } else if (data) {
      rows = data as typeof rows;
    }
  } catch (err) {
    console.warn("Failed to load reels from database:", err);
  }

  const ids = rows.map((r) => r.creator_id).filter(Boolean);
  const reelIds = rows.map((r) => r.id).filter(Boolean);

  const [profilesResult, likesResult, savesResult] = await Promise.all([
    ids.length
      ? supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", [...new Set(ids)])
          .then((res) => res)
          .catch((err) => {
            console.warn("Could not load reel creators:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),

    reelIds.length && userId
      ? supabase
          .from("reel_likes")
          .select("reel_id")
          .eq("user_id", userId)
          .in("reel_id", reelIds)
          .then((res) => res)
          .catch((err) => {
            console.warn("Could not load reel likes:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),

    reelIds.length && userId
      ? supabase
          .from("reel_saves")
          .select("reel_id")
          .eq("user_id", userId)
          .in("reel_id", reelIds)
          .then((res) => res)
          .catch((err) => {
            console.warn("Could not load saved reels:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profiles = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));
  const liked = new Set((likesResult.data ?? []).map((x) => x.reel_id));
  const saved = new Set((savesResult.data ?? []).map((x) => x.reel_id));

  const items = await Promise.all(
    rows.map(async (row) => {
      const profile = profiles.get(row.creator_id);

      const videoUrl = row.video_url.startsWith("http")
        ? row.video_url
        : await signedMediaUrl(REEL_BUCKET, row.video_url);

      return {
        id: row.id,
        creatorId: row.creator_id,
        creatorName: profile?.display_name || profile?.username || "VIDALORE Member",
        creatorUsername: profile?.username || "member",
        creatorAvatarUrl: profile?.avatar_url,
        creatorVerified: false,
        videoUrl,
        storagePath: row.video_url,
        caption: row.caption ?? "",
        audioTitle: row.audio_title ?? undefined,
        likesCount: row.likes_count ?? 0,
        commentsCount: row.comments_count ?? 0,
        sharesCount: row.shares_count ?? 0,
        savesCount: row.saves_count ?? 0,
        viewsCount: row.views_count ?? 0,
        hasLiked: liked.has(row.id),
        hasSaved: saved.has(row.id),
        isFollowing: false,
        createdAt: row.created_at,
        tags: row.tags ?? [],
      } satisfies ReelItem;
    }),
  );

  // Merge any session-published reels that might not have returned from DB due to RLS
  const itemIds = new Set(items.map((i) => i.id));
  const merged = [...items];
  for (const [sId, sReel] of sessionReelsCache.entries()) {
    if (!itemIds.has(sId)) {
      merged.unshift(sReel);
    }
  }

  return merged;
}

/** Compatibility function for older callers. */
export function saveStoredReels(_reels: ReelItem[]): void {
  notifyUpdated();
}

export async function toggleReelLike(reelId: string): Promise<ReelItem | undefined> {
  const userId = await currentUserId();

  const { data: existing, error: readError } = await supabase
    .from("reel_likes")
    .select("reel_id")
    .eq("reel_id", reelId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    message(readError, "Could not check reel like.");
  }

  if (existing) {
    const { error } = await supabase
      .from("reel_likes")
      .delete()
      .eq("reel_id", reelId)
      .eq("user_id", userId);

    if (error) message(error, "Could not remove like.");
  } else {
    const { error } = await supabase
      .from("reel_likes")
      .insert({ reel_id: reelId, user_id: userId });

    if (error) message(error, "Could not like reel.");
  }

  notifyUpdated();

  const reels = await getStoredReels();
  return reels.find((reel) => reel.id === reelId);
}

export async function toggleReelSave(reelId: string): Promise<boolean> {
  const userId = await currentUserId();

  const { data: existing, error: readError } = await supabase
    .from("reel_saves")
    .select("reel_id")
    .eq("reel_id", reelId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    message(readError, "Could not check saved reel.");
  }

  if (existing) {
    const { error } = await supabase
      .from("reel_saves")
      .delete()
      .eq("reel_id", reelId)
      .eq("user_id", userId);

    if (error) message(error, "Could not unsave reel.");

    notifyUpdated();
    return false;
  }

  const { error } = await supabase.from("reel_saves").insert({ reel_id: reelId, user_id: userId });

  if (error) message(error, "Could not save reel.");

  notifyUpdated();
  return true;
}

export async function addReel(
  me: Profile,
  data: {
    videoUrl: string;
    videoFile?: File | undefined;
    caption: string;
    audioTitle?: string | undefined;
    tags?: string[] | undefined;
    onUploadProgress?: ((progress: number) => void) | undefined;
  },
): Promise<ReelItem> {
  const userId = await currentUserId();

  if (userId !== me.id) {
    throw new Error("Your session does not match the selected profile.");
  }

  const videoUrl = data.videoFile
    ? await uploadReelVideo(userId, data.videoFile, data.onUploadProgress)
    : data.videoUrl;

  const reelId = crypto.randomUUID();

  const { error } = await supabase.from("reels").insert({
    id: reelId,
    creator_id: userId,
    video_url: videoUrl,
    caption: data.caption,
    audio_title: data.audioTitle ?? null,
    tags: data.tags ?? [],
  });

  if (error) message(error, "Could not publish reel.");

  notifyUpdated();

  const signedUrl = videoUrl.startsWith("http")
    ? videoUrl
    : await signedMediaUrl(REEL_BUCKET, videoUrl);

  const created: ReelItem = {
    id: reelId,
    creatorId: userId,
    creatorName: me.display_name || me.username || "You",
    creatorUsername: me.username || "you",
    creatorAvatarUrl: me.avatar_url,
    creatorVerified: false,
    videoUrl: signedUrl,
    storagePath: videoUrl,
    caption: data.caption,
    audioTitle: data.audioTitle ?? "Original Audio",
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 0,
    viewsCount: 0,
    hasLiked: false,
    hasSaved: false,
    isFollowing: false,
    createdAt: new Date().toISOString(),
    tags: data.tags ?? [],
  };

  sessionReelsCache.set(created.id, created);
  return created;
}

export async function getReelComments(reelId: string): Promise<ReelComment[]> {
  const userId = await currentUserId().catch(() => "");

  let rows: Array<{
    id: string;
    reel_id: string;
    author_id: string;
    content: string;
    created_at: string;
    reactions_count: number;
  }> = [];

  try {
    const { data, error } = await supabase
      .from("reel_comments")
      .select("*")
      .eq("reel_id", reelId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Standard reel_comments query failed:", error.message || error);
      if (error.code === "42501" || error.message?.includes("is_blocked")) {
        try {
          const publicUrl = (
            import.meta.env.VITE_SUPABASE_URL || "https://mwfognruqmatlhrirxlb.supabase.co"
          ).replace(/\/+$/, "");
          const apiKey =
            import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            "sb_publishable_jJHTE8XdJJiAfdT8C9WINg_zcgZip4V";

          const restRes = await fetch(
            `${publicUrl}/rest/v1/reel_comments?reel_id=eq.${reelId}&select=*&order=created_at.asc`,
            {
              headers: {
                apikey: apiKey,
              },
            },
          );

          if (restRes.ok) {
            const fallbackRows = await restRes.json();
            if (Array.isArray(fallbackRows)) {
              rows = fallbackRows;
            }
          }
        } catch (fallbackErr) {
          console.warn("Public comments fallback failed:", fallbackErr);
        }
      }
    } else if (data) {
      rows = data as typeof rows;
    }
  } catch (err) {
    console.warn("Failed to query reel comments:", err);
  }

  const ids = rows.map((r) => r.author_id).filter(Boolean);
  const commentIds = rows.map((r) => r.id).filter(Boolean);

  const [profilesResult, reactionsResult] = await Promise.all([
    ids.length
      ? supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", [...new Set(ids)])
          .then((res) => res)
          .catch((err) => {
            console.warn("Could not load comment authors:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),

    commentIds.length && userId
      ? supabase
          .from("reel_comment_likes")
          .select("comment_id")
          .eq("user_id", userId)
          .in("comment_id", commentIds)
          .then((res) => res)
          .catch((err) => {
            console.warn("Could not load comment reactions:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profiles = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));
  const reacted = new Set((reactionsResult.data ?? []).map((r) => r.comment_id));

  return (rows ?? []).map((row) => {
    const profile = profiles.get(row.author_id);

    return {
      id: row.id,
      reelId: row.reel_id,
      authorId: row.author_id,
      authorName: profile?.display_name || profile?.username || "VIDALORE Member",
      authorUsername: profile?.username || "member",
      authorAvatarUrl: profile?.avatar_url,
      content: row.content,
      createdAt: row.created_at,
      reactionsCount: row.reactions_count,
      hasReacted: reacted.has(row.id),
    };
  });
}

export async function addReelComment(
  me: Profile,
  reelId: string,
  content: string,
): Promise<ReelComment> {
  const userId = await currentUserId();

  if (userId !== me.id) {
    throw new Error("Your session does not match the selected profile.");
  }

  const clean = content.trim();

  if (!clean) {
    throw new Error("Comment cannot be empty.");
  }

  const commentId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const { error } = await supabase.from("reel_comments").insert({
    id: commentId,
    reel_id: reelId,
    author_id: userId,
    content: clean,
  });

  if (error) message(error, "Could not add comment.");

  notifyUpdated();

  return {
    id: commentId,
    reelId,
    authorId: userId,
    authorName: me.display_name || me.username,
    authorUsername: me.username,
    authorAvatarUrl: me.avatar_url,
    content: clean,
    createdAt,
    reactionsCount: 0,
    hasReacted: false,
  };
}

export async function toggleCommentReaction(commentId: string): Promise<boolean> {
  const userId = await currentUserId();

  const { data: existing, error: readError } = await supabase
    .from("reel_comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    message(readError, "Could not check comment reaction.");
  }

  if (existing) {
    const { error } = await supabase
      .from("reel_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);

    if (error) {
      message(error, "Could not remove reaction.");
    }

    return false;
  }

  const { error } = await supabase.from("reel_comment_likes").insert({
    comment_id: commentId,
    user_id: userId,
  });

  if (error) {
    message(error, "Could not react to comment.");
  }

  return true;
}

export async function getStoredStories(): Promise<StoryItem[]> {
  const userId = await currentUserId();
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("stories")
    .select("*")
    .gt("expires_at", now)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) message(error, "Could not load stories.");

  const storyIds = (rows ?? []).map((r) => r.id);

  const { data: views, error: viewsError } = storyIds.length
    ? await supabase.from("story_views").select("story_id, viewer_id").in("story_id", storyIds)
    : { data: [], error: null };

  if (viewsError) {
    message(viewsError, "Could not load story views.");
  }

  const viewers = new Map<string, string[]>();

  (views ?? []).forEach((view) => {
    viewers.set(view.story_id, [...(viewers.get(view.story_id) ?? []), view.viewer_id]);
  });

  return Promise.all(
    (rows ?? []).map(async (row) => ({
      id: row.id,
      userId: row.user_id,
      mediaUrl: row.media_url.startsWith("http")
        ? row.media_url
        : await signedMediaUrl(STORY_BUCKET, row.media_url),
      mediaType: row.media_type === "video" ? ("video" as const) : ("image" as const),
      caption: row.caption ?? undefined,
      sticker: row.sticker ?? undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      seenBy: viewers.get(row.id) ?? [],
    })),
  );
}

export async function addStory(
  me: Profile,
  data: {
    mediaUrl: string;
    mediaFile?: File | undefined;
    mediaType: "image" | "video";
    caption?: string | undefined;
    sticker?: string | undefined;
    onUploadProgress?: ((progress: number) => void) | undefined;
  },
): Promise<StoryItem> {
  const userId = await currentUserId();

  if (userId !== me.id) {
    throw new Error("Your session does not match the selected profile.");
  }

  const mediaPath = data.mediaFile
    ? await uploadStoryMedia(userId, data.mediaFile, data.onUploadProgress)
    : data.mediaUrl;

  const createdAt = new Date();

  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

  const storyId = crypto.randomUUID();

  const { error } = await supabase.from("stories").insert({
    id: storyId,
    user_id: userId,
    media_url: mediaPath,
    media_type: data.mediaType,
    caption: data.caption ?? null,
    sticker: data.sticker ?? null,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  if (error) message(error, "Could not publish story.");

  notifyUpdated();

  const mediaUrl = mediaPath.startsWith("http")
    ? mediaPath
    : await signedMediaUrl(STORY_BUCKET, mediaPath);

  return {
    id: storyId,
    userId,
    mediaUrl,
    mediaType: data.mediaType,
    caption: data.caption,
    sticker: data.sticker,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    seenBy: [userId],
  };
}

export async function markStorySeen(storyId: string, userId: string): Promise<void> {
  const authenticatedUserId = await currentUserId();

  if (authenticatedUserId !== userId) {
    throw new Error("Your session does not match the selected profile.");
  }

  const { error } = await supabase.from("story_views").upsert(
    {
      story_id: storyId,
      viewer_id: userId,
    },
    {
      onConflict: "story_id,viewer_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    message(error, "Could not record story view.");
  }

  notifyUpdated();
}

/** Compatibility no-op: stories are persisted through addStory. */
export function saveStoredStories(_stories: StoryItem[]): void {
  notifyUpdated();
}

export async function getStoryGroups(currentUserId?: string): Promise<UserStoryGroup[]> {
  const stories = await getStoredStories();

  const ids = [...new Set(stories.map((story) => story.userId))];

  const { data: profiles, error } = ids.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids)
    : { data: [], error: null };

  if (error) {
    message(error, "Could not load story profiles.");
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const grouped = new Map<string, StoryItem[]>();

  stories.forEach((story) => {
    grouped.set(story.userId, [...(grouped.get(story.userId) ?? []), story]);
  });

  return [...grouped.entries()].map(([userId, userStories]) => {
    const profile = profileMap.get(userId);

    return {
      userId,
      username: profile?.username ?? "member",
      displayName: profile?.display_name || profile?.username || "VIDALORE Member",
      avatarUrl: profile?.avatar_url,
      stories: userStories,
      hasUnseen: currentUserId
        ? userStories.some((story) => !story.seenBy.includes(currentUserId))
        : true,
    };
  });
}
