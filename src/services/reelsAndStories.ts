import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
} from "mediabunny";
import type { Profile } from "@/services/profiles";
import { uploadVideoResumable, formatBytes, type VideoUploadProgress } from "@/lib/videoUpload";

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
 * Compresses a story video into MP4/H.264.
 *
 * Target:
 * - Maximum video height: 720px
 * - Frame rate: 30 FPS
 * - Video codec: H.264/AVC
 * - MP4 output
 *
 * If the browser cannot encode the video, the original file is returned.
 * The caller must still enforce the Supabase 50 MB limit.
 */
export async function compressStoryVideo(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<StoryCompressionResult> {
  if (!file.type.startsWith("video/")) {
    return { file, compressed: false };
  }

  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
    return { file, compressed: false };
  }

  let conversion: Awaited<ReturnType<typeof Conversion.init>> | null = null;

  try {
    onProgress?.(0);

    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(file),
    });

    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget(),
    });

    conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        codec: "avc",
        height: 720,
        frameRate: 30,
        quality: new Quality("medium"),
        hardwareAcceleration: "no-preference",
      },
    });

    if (!conversion.isValid) {
      throw new Error("This device cannot convert the selected video to MP4.");
    }

    conversion.onProgress = (progress) => {
      const safeProgress = Math.max(0, Math.min(100, Math.round(progress * 100)));

      onProgress?.(safeProgress);
    };

    await conversion.execute();

    const buffer = output.target.buffer;

    if (!buffer || buffer.byteLength === 0) {
      throw new Error("Video compression produced an empty file.");
    }

    const compressedBlob = new Blob([buffer], {
      type: "video/mp4",
    });

    const compressedFile = new File(
      [compressedBlob],
      `${file.name.replace(/\.[^.]+$/, "")}-compressed.mp4`,
      {
        type: "video/mp4",
        lastModified: Date.now(),
      },
    );

    onProgress?.(100);

    // Do not replace the original with a larger compressed file.
    if (compressedFile.size >= file.size) {
      return {
        file,
        compressed: false,
      };
    }

    return {
      file: compressedFile,
      compressed: true,
    };
  } catch (error) {
    console.warn("Story video compression was unavailable; using original file:", error);

    onProgress?.(100);

    return {
      file,
      compressed: false,
    };
  }
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

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) message(error, "Could not verify your session.");

  if (!data.user) {
    throw new Error("Please sign in to continue.");
  }

  return data.user.id;
}

async function signedMediaUrl(bucket: string, path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_SECONDS);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.warn("createSignedUrl error, falling back to public URL:", err);
  }

  const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path);
  return pubData?.publicUrl || "";
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
  onProgress?: ((progress: VideoUploadProgress | number) => void) | undefined,
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

  // Resumable upload for videos using TUS.
  if (file.type.startsWith("video/")) {
    return uploadVideoResumable(bucket, path, file, (progressInfo) => {
      onProgress?.(progressInfo);
    });
  }

  // Standard upload for images.
  try {
    const totalBytes = file.size;
    onProgress?.({
      stage: "uploading",
      percent: 50,
      bytesUploaded: Math.round(totalBytes * 0.5),
      bytesTotal: totalBytes,
      formattedUploaded: formatBytes(Math.round(totalBytes * 0.5)),
      formattedTotal: formatBytes(totalBytes),
    });

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      message(error, "Media upload failed.");
    }

    onProgress?.({
      stage: "uploading",
      percent: 99,
      bytesUploaded: totalBytes,
      bytesTotal: totalBytes,
      formattedUploaded: formatBytes(totalBytes),
      formattedTotal: formatBytes(totalBytes),
    });
    return path;
  } catch (error) {
    message(error, "Media upload failed. Please check your connection.");
  }
}

export async function uploadReelVideo(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Choose a valid video file.");
  }

  return uploadMedia(REEL_BUCKET, userId, file, MAX_REEL_BYTES);
}

export async function uploadStoryMedia(
  userId: string,
  file: File,
  onProgress?: ((progress: VideoUploadProgress | number) => void) | undefined,
): Promise<string> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Choose an image or video.");
  }

  return uploadMedia(STORY_BUCKET, userId, file, MAX_STORY_BYTES, onProgress);
}

const publishedReelsCache = new Map<string, ReelItem>();

export async function getStoredReels(): Promise<ReelItem[]> {
  const userId = await currentUserId();
  const cachedReels = Array.from(publishedReelsCache.values());

  const { data: rows, error } = await supabase
    .from("reels")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("Could not load reels from database:", error.message || error);
    return cachedReels;
  }

  const ids = (rows ?? []).map((r) => r.creator_id);
  const reelIds = (rows ?? []).map((r) => r.id);

  const [profilesResult, likesResult, savesResult] = await Promise.all([
    ids.length
      ? supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", [...new Set(ids)])
      : Promise.resolve({ data: [], error: null }),

    reelIds.length
      ? supabase.from("reel_likes").select("reel_id").eq("user_id", userId).in("reel_id", reelIds)
      : Promise.resolve({ data: [], error: null }),

    reelIds.length
      ? supabase.from("reel_saves").select("reel_id").eq("user_id", userId).in("reel_id", reelIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    console.warn(
      "Could not load reel creators:",
      profilesResult.error.message || profilesResult.error,
    );
  }

  if (likesResult.error) {
    console.warn("Could not load reel likes:", likesResult.error.message || likesResult.error);
  }

  if (savesResult.error) {
    console.warn("Could not load saved reels:", savesResult.error.message || savesResult.error);
  }

  const profiles = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));

  const liked = new Set((likesResult.data ?? []).map((x) => x.reel_id));

  const saved = new Set((savesResult.data ?? []).map((x) => x.reel_id));

  const fetchedReels = await Promise.all(
    (rows ?? []).map(async (row) => {
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
        caption: row.caption ?? "",
        audioTitle: row.audio_title ?? undefined,
        likesCount: row.likes_count,
        commentsCount: row.comments_count,
        sharesCount: row.shares_count,
        savesCount: row.saves_count,
        viewsCount: row.views_count,
        hasLiked: liked.has(row.id),
        hasSaved: saved.has(row.id),
        isFollowing: false,
        createdAt: row.created_at,
        tags: row.tags ?? [],
      } satisfies ReelItem;
    }),
  );

  const fetchedIds = new Set(fetchedReels.map((r) => r.id));
  const missingCached = cachedReels.filter((c) => !fetchedIds.has(c.id));
  return [...missingCached, ...fetchedReels];
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
  },
): Promise<ReelItem> {
  const userId = await currentUserId();

  if (userId !== me.id) {
    throw new Error("Your session does not match the selected profile.");
  }

  const videoUrl = data.videoFile ? await uploadReelVideo(userId, data.videoFile) : data.videoUrl;

  const reelId = crypto.randomUUID();

  // Insert without selecting representation so PostgREST does not trigger the SELECT RLS policy
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

  const created: ReelItem = {
    id: reelId,
    creatorId: userId,
    creatorName: me.display_name || me.username,
    creatorUsername: me.username,
    creatorAvatarUrl: me.avatar_url,
    creatorVerified: me.points_balance > 100,
    videoUrl,
    caption: data.caption,
    audioTitle: data.audioTitle ?? undefined,
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 0,
    viewsCount: 0,
    hasLiked: false,
    hasSaved: false,
    createdAt: new Date().toISOString(),
    tags: data.tags ?? [],
  };

  publishedReelsCache.set(created.id, created);

  return created;
}

export async function getReelComments(reelId: string): Promise<ReelComment[]> {
  const userId = await currentUserId();

  const { data: rows, error } = await supabase
    .from("reel_comments")
    .select("*")
    .eq("reel_id", reelId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Could not load comments from database:", error.message || error);
    return [];
  }

  const ids = (rows ?? []).map((r) => r.author_id);
  const commentIds = (rows ?? []).map((r) => r.id);

  const [profilesResult, reactionsResult] = await Promise.all([
    ids.length
      ? supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", [...new Set(ids)])
      : Promise.resolve({ data: [], error: null }),

    commentIds.length
      ? supabase
          .from("reel_comment_likes")
          .select("comment_id")
          .eq("user_id", userId)
          .in("comment_id", commentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    console.warn(
      "Could not load comment authors:",
      profilesResult.error.message || profilesResult.error,
    );
  }

  if (reactionsResult.error) {
    console.warn(
      "Could not load comment reactions:",
      reactionsResult.error.message || reactionsResult.error,
    );
  }

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

  const { data, error } = await supabase
    .from("reel_comments")
    .insert({
      reel_id: reelId,
      author_id: userId,
      content: clean,
    })
    .select("id, reel_id, author_id, content, created_at, reactions_count")
    .single();

  if (error) message(error, "Could not add comment.");

  notifyUpdated();

  return {
    id: data.id,
    reelId: data.reel_id,
    authorId: data.author_id,
    authorName: me.display_name || me.username,
    authorUsername: me.username,
    authorAvatarUrl: me.avatar_url,
    content: data.content,
    createdAt: data.created_at,
    reactionsCount: data.reactions_count,
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
    onUploadProgress?: ((progress: VideoUploadProgress | number) => void) | undefined;
  },
): Promise<StoryItem> {
  const userId = await currentUserId();

  if (userId !== me.id) {
    throw new Error("Your session does not match the selected profile.");
  }

  const mediaPath = data.mediaFile
    ? await uploadStoryMedia(userId, data.mediaFile, data.onUploadProgress)
    : data.mediaUrl;

  // Upload complete - now publishing to database
  if (data.mediaFile && data.onUploadProgress) {
    const total = data.mediaFile.size;
    data.onUploadProgress({
      stage: "publishing",
      percent: 99,
      bytesUploaded: total,
      bytesTotal: total,
      formattedUploaded: formatBytes(total),
      formattedTotal: formatBytes(total),
    });
  }

  const createdAt = new Date();

  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

  const { data: row, error } = await supabase
    .from("stories")
    .insert({
      user_id: userId,
      media_url: mediaPath,
      media_type: data.mediaType,
      caption: data.caption ?? null,
      sticker: data.sticker ?? null,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) message(error, "Could not publish story.");

  notifyUpdated();

  // Genuine success: upload verified and database record created
  if (data.mediaFile && data.onUploadProgress) {
    const total = data.mediaFile.size;
    data.onUploadProgress({
      stage: "success",
      percent: 100,
      bytesUploaded: total,
      bytesTotal: total,
      formattedUploaded: formatBytes(total),
      formattedTotal: formatBytes(total),
    });
  }

  const mediaUrl = mediaPath.startsWith("http")
    ? mediaPath
    : await signedMediaUrl(STORY_BUCKET, mediaPath);

  return {
    id: row.id,
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
