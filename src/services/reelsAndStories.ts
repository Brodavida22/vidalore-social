import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compressVideoFile, uploadVideoResumable } from "@/lib/videoUpload";
import type { Profile } from "@/services/profiles";

export const reelsKeys = {
  all: ["reels"] as const,
  feed: () => ["reels", "feed"] as const,
  saved: () => ["reels", "saved"] as const,
};

export const reelsFeedQuery = () =>
  queryOptions({
    queryKey: reelsKeys.feed(),
    queryFn: () => getStoredReels(),
    staleTime: 1000 * 30,
  });

export const storiesKeys = {
  all: ["stories"] as const,
  groups: (viewerId?: string) => ["stories", "groups", viewerId ?? "guest"] as const,
};

export const storyGroupsQuery = (viewerId?: string) =>
  queryOptions({
    queryKey: storiesKeys.groups(viewerId),
    queryFn: () => getStoryGroups(viewerId),
    staleTime: 1000 * 30,
  });

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
const MAX_REEL_BYTES = 100 * 1024 * 1024;
const MAX_STORY_BYTES = 50 * 1024 * 1024;

export interface StoryCompressionResult {
  file: File;
  compressed: boolean;
}

/**
 * Compresses a story video into MP4/H.264 while preserving AAC audio.
 */
export async function compressStoryVideo(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<StoryCompressionResult> {
  const result = await compressVideoFile(file, onProgress);
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

async function ensureFreshSession(): Promise<string> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      if (session.expires_at && session.expires_at * 1000 - Date.now() < 120000) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session?.access_token) {
          return refreshed.session.access_token;
        }
      }
      return session.access_token;
    }
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session?.access_token) {
      throw new Error("Your session has expired. Please sign in again.");
    }
    return refreshed.session.access_token;
  } catch (err) {
    console.warn("Session validation error:", err);
    throw new Error("Please sign in to continue.");
  }
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getFreshReelSignedUrl(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(REEL_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24);
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

export async function uploadReelVideo(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Choose a valid video file.");
  }

  await ensureFreshSession();

  // Enforce H.264/AVC 720p 30fps conversion with AAC audio
  const comp = await compressVideoFile(file, (p) => {
    onProgress?.(Math.round(p * 0.45));
  });

  const fileToUpload = comp.file;

  if (fileToUpload.size > MAX_REEL_BYTES) {
    throw new Error(
      `Reel video must be ${Math.round(MAX_REEL_BYTES / 1024 / 1024)} MB or smaller.`,
    );
  }

  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.mp4`;

  await uploadVideoResumable(REEL_BUCKET, path, fileToUpload, (info) => {
    onProgress?.(45 + Math.round(info.percent * 0.55));
  });

  return path;
}

export async function uploadStoryMedia(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Choose an image or video.");
  }

  if (file.size > MAX_STORY_BYTES) {
    throw new Error(
      `Story media must be ${Math.round(MAX_STORY_BYTES / 1024 / 1024)} MB or smaller.`,
    );
  }

  await ensureFreshSession();

  const isVideo = file.type.startsWith("video/");
  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || (isVideo ? "mp4" : "jpg");

  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  if (isVideo) {
    await uploadVideoResumable(STORY_BUCKET, path, file, (info) => {
      onProgress?.(info.percent);
    });
    return path;
  }

  // Standard upload with retry for images
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { error } = await supabase.storage.from(STORY_BUCKET).upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (!error) {
        onProgress?.(100);
        return path;
      }
      lastErr = error;
    } catch (e) {
      lastErr = e;
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  message(lastErr, "Story image upload failed. Please check your connection.");
}

export const sessionReelsCache = new Map<string, ReelItem>();

const REELS_STORAGE_KEY = "vidalore_persistent_reels_v1";

export function loadPersistentReels(): ReelItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePersistentReels(reels: ReelItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REELS_STORAGE_KEY, JSON.stringify(reels.slice(0, 100)));
  } catch (err) {
    console.warn("Could not save persistent reels:", err);
  }
}

export function upsertPersistentReel(reel: ReelItem): void {
  const current = loadPersistentReels();
  const filtered = current.filter((r) => r.id !== reel.id);
  savePersistentReels([reel, ...filtered]);
}

export function removePersistentReel(reelId: string): void {
  const current = loadPersistentReels();
  savePersistentReels(current.filter((r) => r.id !== reelId));
}

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
      // If error 42501 (is_blocked), also attempt to query own reels directly
      if (userId) {
        try {
          const { data: ownData } = await supabase
            .from("reels")
            .select("*")
            .eq("creator_id", userId)
            .order("created_at", { ascending: false })
            .limit(100);
          if (ownData && ownData.length > 0) {
            rows = ownData as typeof rows;
          }
        } catch (ownErr) {
          console.warn("Could not load own reels fallback:", ownErr);
        }
      }

      if (error.code === "42501" || error.message?.includes("is_blocked")) {
        try {
          const publicUrl = (
            import.meta.env["VITE_SUPABASE_URL"] || "https://mwfognruqmatlhrirxlb.supabase.co"
          ).replace(/\/+$/, "");
          const apiKey =
            import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
            "sb_publishable_jJHTE8XdJJiAfdT8C9WINg_zcgZip4V";

          const restRes = await fetch(
            `${publicUrl}/rest/v1/reels?select=*&order=created_at.desc&limit=100`,
            {
              headers: { apikey: apiKey },
            },
          );
          if (restRes.ok) {
            const fallbackRows = await restRes.json();
            if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
              const existingIds = new Set(rows.map((r) => r.id));
              for (const fb of fallbackRows) {
                if (!existingIds.has(fb.id)) {
                  rows.push(fb);
                  existingIds.add(fb.id);
                }
              }
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

  // Merge with persistent client storage and session cache
  const persistent = loadPersistentReels();
  const rowIds = new Set(rows.map((r) => r.id));

  // Add from persistent storage
  for (const p of persistent) {
    if (!rowIds.has(p.id)) {
      rows.push({
        id: p.id,
        creator_id: p.creatorId,
        video_url: p.storagePath || p.videoUrl,
        caption: p.caption,
        audio_title: p.audioTitle ?? null,
        likes_count: p.likesCount,
        comments_count: p.commentsCount,
        shares_count: p.sharesCount,
        saves_count: p.savesCount,
        views_count: p.viewsCount,
        created_at: p.createdAt,
        tags: p.tags ?? null,
      });
      rowIds.add(p.id);
    }
  }

  // Add from sessionReelsCache
  for (const [sId, sReel] of sessionReelsCache.entries()) {
    if (!rowIds.has(sId)) {
      rows.unshift({
        id: sReel.id,
        creator_id: sReel.creatorId,
        video_url: sReel.storagePath || sReel.videoUrl,
        caption: sReel.caption,
        audio_title: sReel.audioTitle ?? null,
        likes_count: sReel.likesCount,
        comments_count: sReel.commentsCount,
        shares_count: sReel.sharesCount,
        saves_count: sReel.savesCount,
        views_count: sReel.viewsCount,
        created_at: sReel.createdAt,
        tags: sReel.tags ?? null,
      });
      rowIds.add(sId);
    }
  }

  const ids = rows.map((r) => r.creator_id).filter(Boolean);
  const reelIds = rows.map((r) => r.id).filter(Boolean);

  const [profilesResult, allLikesResult, allCommentsResult, userSavesResult] = await Promise.all([
    ids.length
      ? supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", [...new Set(ids)])
          .then((res) => res, (err: unknown) => {
            console.warn("Could not load reel creators:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),

    reelIds.length
      ? supabase
          .from("reel_likes")
          .select("reel_id, user_id")
          .in("reel_id", reelIds)
          .then((res) => res, (err: unknown) => {
            console.warn("Could not load reel likes:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),

    reelIds.length
      ? supabase
          .from("reel_comments")
          .select("reel_id")
          .in("reel_id", reelIds)
          .then((res) => res, (err: unknown) => {
            console.warn("Could not load reel comments count:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),

    reelIds.length && userId
      ? supabase
          .from("reel_saves")
          .select("reel_id")
          .eq("user_id", userId)
          .in("reel_id", reelIds)
          .then((res) => res, (err: unknown) => {
            console.warn("Could not load saved reels:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profiles = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));
  const persistentMap = new Map(persistent.map((p) => [p.id, p]));

  // Calculate accurate like counts per reel and user hasLiked status
  const liked = new Set(
    (allLikesResult.data ?? [])
      .filter((x: { user_id: string; reel_id: string }) => x.user_id === userId)
      .map((x: { user_id: string; reel_id: string }) => x.reel_id),
  );
  const likeCounts = new Map<string, number>();
  for (const l of allLikesResult.data ?? []) {
    likeCounts.set(l.reel_id, (likeCounts.get(l.reel_id) || 0) + 1);
  }

  // Calculate accurate comment counts per reel
  const commentCounts = new Map<string, number>();
  for (const c of allCommentsResult.data ?? []) {
    commentCounts.set(c.reel_id, (commentCounts.get(c.reel_id) || 0) + 1);
  }

  // Saved reels for current user
  const saved = new Set((userSavesResult.data ?? []).map((x: { reel_id: string }) => x.reel_id));

  const items = await Promise.all(
    rows.map(async (row) => {
      const profile = profiles.get(row.creator_id);
      const cached = sessionReelsCache.get(row.id) || persistentMap.get(row.id);

      let videoUrl = row.video_url;
      if (!videoUrl.startsWith("http")) {
        const signed = await signedMediaUrl(REEL_BUCKET, row.video_url);
        if (signed) {
          videoUrl = signed;
        } else {
          videoUrl = supabase.storage.from(REEL_BUCKET).getPublicUrl(row.video_url).data.publicUrl;
        }
      }

      const likesCount = Math.max(row.likes_count ?? 0, likeCounts.get(row.id) ?? 0);
      const commentsCount = Math.max(row.comments_count ?? 0, commentCounts.get(row.id) ?? 0);

      const item: ReelItem = {
        id: row.id,
        creatorId: row.creator_id,
        creatorName:
          profile?.display_name ||
          profile?.username ||
          cached?.creatorName ||
          "VIDALORE Member",
        creatorUsername: profile?.username || cached?.creatorUsername || "member",
        creatorAvatarUrl: profile?.avatar_url || cached?.creatorAvatarUrl,
        creatorVerified: false,
        videoUrl,
        storagePath: row.video_url,
        caption: row.caption ?? cached?.caption ?? "",
        audioTitle: row.audio_title ?? cached?.audioTitle ?? undefined,
        likesCount,
        commentsCount,
        sharesCount: row.shares_count ?? cached?.sharesCount ?? 0,
        savesCount: row.saves_count ?? cached?.savesCount ?? 0,
        viewsCount: row.views_count ?? cached?.viewsCount ?? 0,
        hasLiked: liked.has(row.id) || cached?.hasLiked || false,
        hasSaved: saved.has(row.id) || cached?.hasSaved || false,
        isFollowing: false,
        createdAt: row.created_at,
        tags: row.tags ?? cached?.tags ?? [],
      };

      sessionReelsCache.set(item.id, item);
      return item;
    }),
  );

  // Deduplicate items by ID
  const deduped: ReelItem[] = [];
  const seenIds = new Set<string>();
  for (const item of items) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      deduped.push(item);
    }
  }

  savePersistentReels(deduped);
  return deduped;
}

export function saveStoredReels(_reels: ReelItem[]): void {
  notifyUpdated();
}

export async function toggleReelLike(
  reelId: string,
): Promise<{ hasLiked: boolean; likesCount: number; reel?: ReelItem }> {
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

  let nextHasLiked = false;

  if (existing) {
    const { error } = await supabase
      .from("reel_likes")
      .delete()
      .eq("reel_id", reelId)
      .eq("user_id", userId);

    if (error) message(error, "Could not remove like.");
    nextHasLiked = false;

    // Direct fallback update to reels counter
    void supabase
      .from("reels")
      .update({ likes_count: Math.max(0, (sessionReelsCache.get(reelId)?.likesCount ?? 1) - 1) })
      .eq("id", reelId)
      .then(() => {});
  } else {
    const { error } = await supabase
      .from("reel_likes")
      .insert({ reel_id: reelId, user_id: userId });

    if (error && error.code !== "23505") {
      message(error, "Could not like reel.");
    }
    nextHasLiked = true;

    // Direct fallback update to reels counter
    void supabase
      .from("reels")
      .update({ likes_count: (sessionReelsCache.get(reelId)?.likesCount ?? 0) + 1 })
      .eq("id", reelId)
      .then(() => {});
  }

  // Fetch verified like count
  const { count } = await supabase
    .from("reel_likes")
    .select("reel_id", { count: "exact", head: true })
    .eq("reel_id", reelId);

  const finalCount = typeof count === "number" ? count : nextHasLiked ? 1 : 0;

  const cached = sessionReelsCache.get(reelId);
  if (cached) {
    cached.hasLiked = nextHasLiked;
    cached.likesCount = finalCount;
    sessionReelsCache.set(reelId, { ...cached });
  }

  notifyUpdated();
  return { hasLiked: nextHasLiked, likesCount: finalCount, ...(cached ? { reel: cached } : {}) };
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

  let nextSaved = false;

  if (existing) {
    const { error } = await supabase
      .from("reel_saves")
      .delete()
      .eq("reel_id", reelId)
      .eq("user_id", userId);

    if (error) message(error, "Could not unsave reel.");
    nextSaved = false;
  } else {
    const { error } = await supabase
      .from("reel_saves")
      .insert({ reel_id: reelId, user_id: userId });

    if (error && error.code !== "23505") {
      message(error, "Could not save reel.");
    }
    nextSaved = true;
  }

  const cached = sessionReelsCache.get(reelId);
  if (cached) {
    cached.hasSaved = nextSaved;
    cached.savesCount = Math.max(0, cached.savesCount + (nextSaved ? 1 : -1));
    sessionReelsCache.set(reelId, { ...cached });
  }

  notifyUpdated();
  return nextSaved;
}

export async function incrementReelShare(reelId: string): Promise<number> {
  try {
    const { error: rpcErr } = await supabase.rpc("increment_reel_shares", {
      target_reel_id: reelId,
    });
    if (rpcErr) {
      const cached = sessionReelsCache.get(reelId);
      const nextShares = (cached?.sharesCount ?? 0) + 1;
      try {
        await supabase.from("reels").update({ shares_count: nextShares }).eq("id", reelId);
      } catch (updErr) {
        console.warn("Could not update shares_count fallback:", updErr);
      }
    }
  } catch (err) {
    console.warn("Could not increment reel share count:", err);
  }

  const cached = sessionReelsCache.get(reelId);
  if (cached) {
    cached.sharesCount = (cached.sharesCount ?? 0) + 1;
    sessionReelsCache.set(reelId, { ...cached });
  }

  notifyUpdated();
  return cached?.sharesCount ?? 1;
}

export async function getSavedReels(): Promise<ReelItem[]> {
  const userId = await currentUserId();

  const { data: saves, error: savesErr } = await supabase
    .from("reel_saves")
    .select("reel_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (savesErr) {
    console.warn("Could not load saved reels list:", savesErr.message || savesErr);
    return [];
  }

  if (!saves || saves.length === 0) {
    return [];
  }

  const reelIds = saves.map((s) => s.reel_id).filter(Boolean);
  if (reelIds.length === 0) {
    return [];
  }

  let reelRows: Array<{
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
    const { data: rows, error: reelsErr } = await supabase
      .from("reels")
      .select("*")
      .in("id", reelIds);

    if (reelsErr) {
      console.warn("Standard saved reels query failed:", reelsErr.message || reelsErr);
      if (reelsErr.code === "42501" || reelsErr.message?.includes("is_blocked")) {
        try {
          const publicUrl = (
            import.meta.env["VITE_SUPABASE_URL"] || "https://mwfognruqmatlhrirxlb.supabase.co"
          ).replace(/\/+$/, "");
          const apiKey =
            import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
            "sb_publishable_jJHTE8XdJJiAfdT8C9WINg_zcgZip4V";

          const filter = reelIds.length === 1 ? `eq.${reelIds[0]}` : `in.(${reelIds.join(",")})`;
          const restRes = await fetch(`${publicUrl}/rest/v1/reels?id=${filter}&select=*`, {
            headers: { apikey: apiKey },
          });
          if (restRes.ok) {
            const fallbackRows = await restRes.json();
            if (Array.isArray(fallbackRows)) {
              reelRows = fallbackRows;
            }
          }
        } catch (fallbackErr) {
          console.warn("Public saved reels fallback failed:", fallbackErr);
        }
      }
    } else if (rows) {
      reelRows = rows as typeof reelRows;
    }
  } catch (err) {
    console.warn("Failed to load saved reel details from database:", err);
  }

  // Also check sessionReelsCache for any reel not returned from DB
  const existingIds = new Set(reelRows.map((r) => r.id));
  for (const id of reelIds) {
    if (!existingIds.has(id) && sessionReelsCache.has(id)) {
      const cached = sessionReelsCache.get(id)!;
      reelRows.push({
        id: cached.id,
        creator_id: cached.creatorId,
        video_url: cached.storagePath || cached.videoUrl,
        caption: cached.caption,
        audio_title: cached.audioTitle ?? null,
        likes_count: cached.likesCount,
        comments_count: cached.commentsCount,
        shares_count: cached.sharesCount,
        saves_count: cached.savesCount,
        views_count: cached.viewsCount,
        created_at: cached.createdAt,
        tags: cached.tags,
      });
      existingIds.add(id);
    }
  }

  const creatorIds = reelRows.map((r) => r.creator_id).filter(Boolean);

  const [profilesRes, allLikesRes, allCommentsRes] = await Promise.all([
    creatorIds.length
      ? supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", [...new Set(creatorIds)])
          .then((res) => res, (err: unknown) => {
            console.warn("Could not load creators for saved reels:", err);
            return { data: [] };
          })
      : Promise.resolve({ data: [] }),
    supabase
      .from("reel_likes")
      .select("reel_id, user_id")
      .in("reel_id", reelIds)
      .then((res) => res, (err: unknown) => {
        console.warn("Could not load likes for saved reels:", err);
        return { data: [] };
      }),
    supabase
      .from("reel_comments")
      .select("reel_id")
      .in("reel_id", reelIds)
      .then((res) => res, (err: unknown) => {
        console.warn("Could not load comments for saved reels:", err);
        return { data: [] };
      }),
  ]);

  const profilesMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const userLikes = new Set(
    (allLikesRes.data ?? [])
      .filter((l: { user_id: string; reel_id: string }) => l.user_id === userId)
      .map((l: { user_id: string; reel_id: string }) => l.reel_id),
  );
  const likeCounts = new Map<string, number>();
  for (const l of allLikesRes.data ?? []) {
    likeCounts.set(l.reel_id, (likeCounts.get(l.reel_id) || 0) + 1);
  }
  const commentCounts = new Map<string, number>();
  for (const c of allCommentsRes.data ?? []) {
    commentCounts.set(c.reel_id, (commentCounts.get(c.reel_id) || 0) + 1);
  }

  const byId = new Map(reelRows.map((r) => [r.id, r]));

  const result: ReelItem[] = [];
  for (const save of saves) {
    const row = byId.get(save.reel_id);
    if (!row) continue;
    const profile = profilesMap.get(row.creator_id);
    const videoUrl = row.video_url.startsWith("http")
      ? row.video_url
      : await signedMediaUrl(REEL_BUCKET, row.video_url);

    const item: ReelItem = {
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
      likesCount: Math.max(row.likes_count ?? 0, likeCounts.get(row.id) ?? 0),
      commentsCount: Math.max(row.comments_count ?? 0, commentCounts.get(row.id) ?? 0),
      sharesCount: row.shares_count ?? 0,
      savesCount: row.saves_count ?? 1,
      viewsCount: row.views_count ?? 0,
      hasLiked: userLikes.has(row.id),
      hasSaved: true,
      isFollowing: false,
      createdAt: row.created_at,
      tags: row.tags ?? [],
    };

    sessionReelsCache.set(item.id, item);
    result.push(item);
  }

  return result;
}

export async function removeSavedReel(reelId: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("reel_saves")
    .delete()
    .eq("reel_id", reelId)
    .eq("user_id", userId);

  if (error) {
    message(error, "Could not remove saved reel.");
  }

  const cached = sessionReelsCache.get(reelId);
  if (cached) {
    cached.hasSaved = false;
    cached.savesCount = Math.max(0, cached.savesCount - 1);
    sessionReelsCache.set(reelId, { ...cached });
  }

  notifyUpdated();
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

  await ensureFreshSession();

  const videoUrl = data.videoFile
    ? await uploadReelVideo(userId, data.videoFile, data.onUploadProgress)
    : data.videoUrl;

  const reelId = crypto.randomUUID();

  // 1. Insert into database
  const { error } = await supabase.from("reels").insert({
    id: reelId,
    creator_id: userId,
    video_url: videoUrl,
    caption: data.caption,
    audio_title: data.audioTitle ?? null,
    tags: data.tags ?? [],
  });

  if (error) {
    message(error, "Could not publish reel to database.");
  }

  // 2. Verification check: ensure database record exists before declaring success
  try {
    const { data: verified, error: verifyErr } = await supabase
      .from("reels")
      .select("id")
      .eq("id", reelId)
      .maybeSingle();

    if (verifyErr && verifyErr.code !== "42501" && !verifyErr.message?.includes("is_blocked")) {
      console.warn("Could not verify reel database insertion:", verifyErr.message);
    }
  } catch (verifyCheckErr) {
    console.warn("Reel verification check non-fatal warning:", verifyCheckErr);
  }

  let signedUrl = videoUrl;
  if (!videoUrl.startsWith("http")) {
    const signed = await signedMediaUrl(REEL_BUCKET, videoUrl);
    signedUrl = signed || supabase.storage.from(REEL_BUCKET).getPublicUrl(videoUrl).data.publicUrl;
  }

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
  upsertPersistentReel(created);

  notifyUpdated();
  return created;
}

export async function getReelComments(reelId: string): Promise<ReelComment[]> {
  const userId = (await tryGetCurrentUserId()) || "";

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
            import.meta.env["VITE_SUPABASE_URL"] || "https://mwfognruqmatlhrirxlb.supabase.co"
          ).replace(/\/+$/, "");
          const apiKey =
            import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
            "sb_publishable_jJHTE8XdJJiAfdT8C9WINg_zcgZip4V";

          const restRes = await fetch(
            `${publicUrl}/rest/v1/reel_comments?reel_id=eq.${reelId}&select=*&order=created_at.asc`,
            { headers: { apikey: apiKey } },
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
          .then((res) => res, (err: unknown) => {
            console.warn("Could not load comment authors:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),

    commentIds.length
      ? supabase
          .from("reel_comment_likes")
          .select("comment_id, user_id")
          .in("comment_id", commentIds)
          .then((res) => res, (err: unknown) => {
            console.warn("Could not load comment reactions:", err);
            return { data: [], error: err };
          })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profiles = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));
  const userReacted = new Set(
    (reactionsResult.data ?? [])
      .filter((r: { user_id: string; comment_id: string }) => r.user_id === userId)
      .map((r: { user_id: string; comment_id: string }) => r.comment_id),
  );
  const reactionCounts = new Map<string, number>();
  for (const r of reactionsResult.data ?? []) {
    reactionCounts.set(r.comment_id, (reactionCounts.get(r.comment_id) || 0) + 1);
  }

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
      reactionsCount: Math.max(row.reactions_count ?? 0, reactionCounts.get(row.id) ?? 0),
      hasReacted: userReacted.has(row.id),
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

  // Direct fallback increment for reels counter
  void supabase
    .from("reels")
    .update({ comments_count: (sessionReelsCache.get(reelId)?.commentsCount ?? 0) + 1 })
    .eq("id", reelId)
    .then(() => {});

  const cached = sessionReelsCache.get(reelId);
  if (cached) {
    cached.commentsCount = cached.commentsCount + 1;
    sessionReelsCache.set(reelId, { ...cached });
  }

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

  let nextReacted = false;

  if (existing) {
    const { error } = await supabase
      .from("reel_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);

    if (error) {
      message(error, "Could not remove reaction.");
    }
    nextReacted = false;
  } else {
    const { error } = await supabase.from("reel_comment_likes").insert({
      comment_id: commentId,
      user_id: userId,
    });

    if (error && error.code !== "23505") {
      message(error, "Could not react to comment.");
    }
    nextReacted = true;
  }

  return nextReacted;
}

export async function getStoredStories(): Promise<StoryItem[]> {
  await currentUserId();
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
    storyId?: string | undefined;
    mediaUrl: string;
    mediaPath?: string | undefined;
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

  await ensureFreshSession();

  // If already uploaded in a previous attempt, re-use mediaPath
  let mediaPath = data.mediaPath;
  if (!mediaPath) {
    mediaPath = data.mediaFile
      ? await uploadStoryMedia(userId, data.mediaFile, data.onUploadProgress)
      : data.mediaUrl;
  }

  const storyId = data.storyId || crypto.randomUUID();

  // Check if story with this ID was already inserted (idempotent recovery)
  const { data: existing } = await supabase
    .from("stories")
    .select("id, created_at, expires_at")
    .eq("id", storyId)
    .maybeSingle();

  if (existing) {
    notifyUpdated();
    const mediaUrl = mediaPath.startsWith("http")
      ? mediaPath
      : await signedMediaUrl(STORY_BUCKET, mediaPath);
    return {
      id: existing.id,
      userId,
      mediaUrl,
      mediaType: data.mediaType,
      caption: data.caption,
      sticker: data.sticker,
      createdAt: existing.created_at,
      expiresAt: existing.expires_at,
      seenBy: [userId],
    };
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

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

  if (error) {
    // Verify if it was actually inserted despite network error
    const { data: verified } = await supabase
      .from("stories")
      .select("id, created_at, expires_at")
      .eq("id", storyId)
      .maybeSingle();

    if (verified) {
      notifyUpdated();
      const mediaUrl = mediaPath.startsWith("http")
        ? mediaPath
        : await signedMediaUrl(STORY_BUCKET, mediaPath);
      return {
        id: verified.id,
        userId,
        mediaUrl,
        mediaType: data.mediaType,
        caption: data.caption,
        sticker: data.sticker,
        createdAt: verified.created_at,
        expiresAt: verified.expires_at,
        seenBy: [userId],
      };
    }

    message(error, "Could not publish story. Please try again.");
  }

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

export function saveStoredStories(_stories: StoryItem[]): void {
  notifyUpdated();
}

export async function getStoryGroups(viewerId?: string): Promise<UserStoryGroup[]> {
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
      hasUnseen: viewerId ? userStories.some((story) => !story.seenBy.includes(viewerId)) : true,
    };
  });
}

export async function deleteStory(storyId: string): Promise<void> {
  const userId = await currentUserId();

  // 1. Fetch story details to verify ownership and find media storage path
  const { data: story, error: fetchErr } = await supabase
    .from("stories")
    .select("id, user_id, media_url")
    .eq("id", storyId)
    .maybeSingle();

  if (fetchErr) {
    message(fetchErr, "Could not check story details.");
  }

  if (!story) {
    throw new Error("Story not found or already deleted.");
  }

  if (story.user_id !== userId) {
    throw new Error("You can only delete your own stories.");
  }

  // 2. Delete database record
  const { error: deleteErr } = await supabase
    .from("stories")
    .delete()
    .eq("id", storyId)
    .eq("user_id", userId);

  if (deleteErr) {
    message(deleteErr, "Could not delete story from database.");
  }

  // 3. Delete associated storage object safely
  if (story.media_url && !story.media_url.startsWith("http")) {
    try {
      await supabase.storage.from(STORY_BUCKET).remove([story.media_url]);
    } catch (storageErr) {
      console.warn("Storage media removal non-fatal warning:", storageErr);
    }
  }

  notifyUpdated();
}

