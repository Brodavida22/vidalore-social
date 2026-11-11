import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compressVideo, uploadResumableTus } from "@/services/mediaUpload";

export interface CreatePostProgress {
  stage: "preparing" | "compressing" | "uploading" | "publishing";
  percent: number;
  message?: string;
  bytesUploaded?: number;
  bytesTotal?: number;
  compressedSavings?: number;
}

// ---------------------------------------------------------------------------
// Rules (mirrored by database constraints and storage policies)
// ---------------------------------------------------------------------------
export const POST_LIMITS = {
  maxMedia: 4,
  maxTags: 3,
  maxContent: 600,
  maxRepostNote: 300,
  maxComment: 1000,
  maxFileBytes: 50 * 1024 * 1024,
} as const;

export const POST_MEDIA_MIME_TYPES: Record<string, { type: "image" | "video"; ext: string }> = {
  "image/jpeg": { type: "image", ext: "jpg" },
  "image/png": { type: "image", ext: "png" },
  "image/webp": { type: "image", ext: "webp" },
  "image/gif": { type: "image", ext: "gif" },
  "video/mp4": { type: "video", ext: "mp4" },
  "video/webm": { type: "video", ext: "webm" },
  "video/quicktime": { type: "video", ext: "mov" },
};

export const POST_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov";

const BUCKET = "post-media";
const SIGNED_URL_TTL = 60 * 60; // seconds

export interface DraftFile {
  name?: string;
  type: string;
  size: number;
}

export function detectMediaInfo(file: { name?: string; type?: string }): {
  type: "image" | "video";
  ext: string;
  mime: string;
} | null {
  const rawType = (file.type || "").toLowerCase().split(";")[0]?.trim() || "";
  if (POST_MEDIA_MIME_TYPES[rawType]) {
    return {
      type: POST_MEDIA_MIME_TYPES[rawType]!.type,
      ext: POST_MEDIA_MIME_TYPES[rawType]!.ext,
      mime: rawType,
    };
  }

  // Fallback to file extension
  const ext = (file.name || "").split(".").pop()?.toLowerCase();
  if (ext) {
    if (ext === "mp4" || ext === "m4v") return { type: "video", ext: "mp4", mime: "video/mp4" };
    if (ext === "webm") return { type: "video", ext: "webm", mime: "video/webm" };
    if (ext === "mov" || ext === "qt")
      return { type: "video", ext: "mov", mime: "video/quicktime" };
    if (ext === "jpg" || ext === "jpeg") return { type: "image", ext: "jpg", mime: "image/jpeg" };
    if (ext === "png") return { type: "image", ext: "png", mime: "image/png" };
    if (ext === "webp") return { type: "image", ext: "webp", mime: "image/webp" };
    if (ext === "gif") return { type: "image", ext: "gif", mime: "image/gif" };
  }

  return null;
}

/** Returns a user-facing error message, or null if the draft is valid. */
export function validatePostDraft(draft: {
  content: string;
  files: DraftFile[];
  tags: string[];
}): string | null {
  const content = draft.content.trim();
  if (!content && draft.files.length === 0) {
    return "Please write something or attach a photo/video before posting.";
  }
  if (content.length > POST_LIMITS.maxContent) {
    return `Posts can be up to ${POST_LIMITS.maxContent} characters.`;
  }
  if (draft.tags.length > POST_LIMITS.maxTags) {
    return `Up to ${POST_LIMITS.maxTags} tags per post.`;
  }
  if (draft.files.length > POST_LIMITS.maxMedia) {
    return `Maximum ${POST_LIMITS.maxMedia} media attachments per post.`;
  }
  for (const f of draft.files) {
    const info = detectMediaInfo(f);
    if (!info) {
      return "Only JPG, PNG, WebP, GIF, MP4, WebM or MOV files can be attached.";
    }
    if (f.size > POST_LIMITS.maxFileBytes) {
      return "Each file must be 50 MB or smaller.";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface PostMedia {
  id: string;
  type: "image" | "video";
  url: string;
  storagePath?: string | undefined;
  caption?: string | undefined;
}

export interface PostPerson {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null | undefined;
}

export interface SocialPost {
  /** The feed row id (the repost row for reposts). Used as list key and for edit/delete. */
  id: string;
  /** The post that likes, comments, saves and reposts apply to (the original for reposts). */
  postId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string | null | undefined;
  authorPoints?: number | undefined;
  content: string;
  media: PostMedia[];
  tags: string[];
  mood?: string | undefined;
  location?: string | undefined;
  createdAt: string;
  isEdited: boolean;
  reactionsCount: number;
  hasReacted: boolean;
  commentsCount: number;
  sharesCount: number;
  hasShared: boolean;
  savesCount: number;
  hasSaved: boolean;
  isRepost: boolean;
  repostNote?: string | undefined;
  reposter?: PostPerson | undefined;
  repostedAt?: string | undefined;
  /** True when this is a repost whose original the viewer cannot see (deleted or private). */
  originalUnavailable?: boolean | undefined;
}

export interface PostComment {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string | null | undefined;
  content: string;
  createdAt: string;
  isEdited: boolean;
  reactionsCount: number;
  hasReacted: boolean;
}

export interface PostCounts {
  reactionsCount: number;
  commentsCount: number;
  savesCount: number;
  sharesCount: number;
}

interface AuthorRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  points_balance: number;
}

interface MediaRow {
  id: string;
  storage_path: string;
  media_type: string;
  position: number;
}

interface PostRow {
  id: string;
  author_id: string;
  content: string;
  tags: string[];
  mood: string | null;
  location: string | null;
  repost_of_id: string | null;
  repost_note: string | null;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  reposts_count: number;
  created_at: string;
  updated_at: string;
  author: AuthorRow | null;
  media: MediaRow[] | null;
}

const POST_SELECT = `id, author_id, content, tags, mood, location, repost_of_id, repost_note,
  likes_count, comments_count, saves_count, reposts_count, created_at, updated_at,
  author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, points_balance),
  media:post_media(id, storage_path, media_type, position)`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Please sign in first.");
  return id;
}

function friendlyError(error: { code?: string; message: string } | null, fallback: string): Error {
  if (!error) return new Error(fallback);
  if (error.code === "42501") return new Error("You don't have permission to do that.");
  return new Error(error.message || fallback);
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = Date.now();
  const missing: string[] = [];
  for (const p of new Set(paths)) {
    const cached = signedUrlCache.get(p);
    if (cached && cached.expiresAt - 5 * 60 * 1000 > now) out.set(p, cached.url);
    else missing.push(p);
  }
  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL);
    if (!error && data) {
      for (const item of data) {
        if (item.path && item.signedUrl) {
          out.set(item.path, item.signedUrl);
          signedUrlCache.set(item.path, {
            url: item.signedUrl,
            expiresAt: now + SIGNED_URL_TTL * 1000,
          });
        }
      }
    }
  }
  return out;
}

export async function getFreshSignedUrl(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL);
    if (!error && data?.signedUrl) {
      signedUrlCache.set(storagePath, {
        url: data.signedUrl,
        expiresAt: Date.now() + SIGNED_URL_TTL * 1000,
      });
      return data.signedUrl;
    }
  } catch (err) {
    console.warn("Failed to refresh signed URL for", storagePath, err);
  }
  return null;
}

function personFrom(author: AuthorRow | null, fallbackId: string): PostPerson {
  return {
    id: author?.id ?? fallbackId,
    name: author?.display_name || author?.username || "Member",
    username: author?.username ?? "member",
    avatarUrl: author?.avatar_url ?? null,
  };
}

function isEdited(createdAt: string, updatedAt: string) {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 2000;
}

/** Turns raw rows into display posts: resolves originals, viewer state and signed media URLs. */
async function hydratePosts(rows: PostRow[]): Promise<SocialPost[]> {
  if (rows.length === 0) return [];
  const uid = await currentUserId();

  // Load originals for reposts
  const originalIds = [...new Set(rows.map((r) => r.repost_of_id).filter((v): v is string => !!v))];
  const originals = new Map<string, PostRow>();
  if (originalIds.length > 0) {
    const { data, error } = await supabase.from("posts").select(POST_SELECT).in("id", originalIds);
    if (error) throw friendlyError(error, "Couldn't load posts.");
    for (const o of (data ?? []) as unknown as PostRow[]) originals.set(o.id, o);
  }

  const targetIds = [...new Set(rows.map((r) => r.repost_of_id ?? r.id).filter((id) => !!id))];

  const [blockedRes, likesRes, savesRes, repostsRes] = await Promise.all([
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", uid),
    supabase.from("post_likes").select("post_id").eq("user_id", uid).in("post_id", targetIds),
    supabase.from("post_saves").select("post_id").eq("user_id", uid).in("post_id", targetIds),
    supabase
      .from("posts")
      .select("repost_of_id")
      .eq("author_id", uid)
      .in("repost_of_id", targetIds),
  ]);
  if (likesRes.error) throw friendlyError(likesRes.error, "Couldn't load posts.");
  if (savesRes.error) throw friendlyError(savesRes.error, "Couldn't load posts.");
  if (repostsRes.error) throw friendlyError(repostsRes.error, "Couldn't load posts.");
  const blockedIds = new Set((blockedRes.data ?? []).map((b) => b.blocked_id));
  const liked = new Set((likesRes.data ?? []).map((r) => r.post_id));
  const saved = new Set((savesRes.data ?? []).map((r) => r.post_id));
  const reposted = new Set((repostsRes.data ?? []).map((r) => r.repost_of_id));

  // Exclude posts authored or reposted by blocked users
  const visibleRows = rows.filter(
    (r) =>
      !blockedIds.has(r.author_id) &&
      (!r.repost_of_id || !blockedIds.has(originals.get(r.repost_of_id)?.author_id ?? "")),
  );

  const allPaths: string[] = [];
  for (const r of [...visibleRows, ...originals.values()]) {
    for (const m of r.media ?? []) allPaths.push(m.storage_path);
  }
  const urls = await signPaths(allPaths);

  return visibleRows.map((row) => {
    const isRepost = !!row.repost_of_id;
    const source = isRepost ? (originals.get(row.repost_of_id!) ?? null) : row;
    const sourceAuthor = personFrom(source?.author ?? null, source?.author_id ?? row.author_id);
    const media: PostMedia[] = [...(source?.media ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        type: m.media_type === "video" ? "video" : "image",
        url: urls.get(m.storage_path) ?? "",
        storagePath: m.storage_path,
      }));
    const targetId = source?.id ?? row.repost_of_id ?? row.id;

    return {
      id: row.id,
      postId: targetId,
      authorId: sourceAuthor.id,
      authorName: sourceAuthor.name,
      authorUsername: sourceAuthor.username,
      authorAvatarUrl: sourceAuthor.avatarUrl,
      authorPoints: source?.author?.points_balance,
      content: source?.content ?? "",
      media,
      tags: source?.tags ?? [],
      mood: source?.mood ?? undefined,
      location: source?.location ?? undefined,
      createdAt: source?.created_at ?? row.created_at,
      isEdited: source ? isEdited(source.created_at, source.updated_at) : false,
      reactionsCount: source?.likes_count ?? 0,
      hasReacted: liked.has(targetId),
      commentsCount: source?.comments_count ?? 0,
      sharesCount: source?.reposts_count ?? 0,
      hasShared: reposted.has(targetId),
      savesCount: source?.saves_count ?? 0,
      hasSaved: saved.has(targetId),
      isRepost,
      repostNote: row.repost_note ?? undefined,
      reposter: isRepost ? personFrom(row.author, row.author_id) : undefined,
      repostedAt: isRepost ? row.created_at : undefined,
      originalUnavailable: isRepost && !source,
    } satisfies SocialPost;
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export type FeedMode = "for-you" | "following" | "trending";
const FEED_LIMIT = 50;

export async function fetchFeed(mode: FeedMode): Promise<SocialPost[]> {
  const uid = await currentUserId();
  let query = supabase.from("posts").select(POST_SELECT);

  if (mode === "following") {
    const { data: follows, error } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", uid);
    if (error) throw friendlyError(error, "Couldn't load your feed.");
    const ids = [uid, ...(follows ?? []).map((f) => f.following_id)];
    query = query.in("author_id", ids).order("created_at", { ascending: false });
  } else if (mode === "trending") {
    query = query
      .is("repost_of_id", null)
      .order("likes_count", { ascending: false })
      .order("comments_count", { ascending: false })
      .order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.limit(FEED_LIMIT);
  if (error) throw friendlyError(error, "Couldn't load your feed.");
  return hydratePosts((data ?? []) as unknown as PostRow[]);
}

export async function fetchExplorePosts(tag: string | null): Promise<SocialPost[]> {
  let query = supabase.from("posts").select(POST_SELECT).is("repost_of_id", null);
  if (tag) query = query.contains("tags", [tag]);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(60);
  if (error) throw friendlyError(error, "Couldn't load posts.");
  return hydratePosts((data ?? []) as unknown as PostRow[]);
}

export async function fetchUserPosts(userId: string): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (error) throw friendlyError(error, "Couldn't load posts.");
  return hydratePosts((data ?? []) as unknown as PostRow[]);
}

export async function fetchMentionPosts(username: string): Promise<SocialPost[]> {
  const safe = username.replace(/[^a-zA-Z0-9_]/g, "");
  if (!safe) return [];
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .is("repost_of_id", null)
    .ilike("content", `%@${safe}%`)
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (error) throw friendlyError(error, "Couldn't load posts.");
  return hydratePosts((data ?? []) as unknown as PostRow[]);
}

export async function fetchSavedPosts(): Promise<SocialPost[]> {
  const uid = await currentUserId();
  const { data: saves, error } = await supabase
    .from("post_saves")
    .select("post_id, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw friendlyError(error, "Couldn't load saved posts.");
  const ids = (saves ?? []).map((s) => s.post_id);
  if (ids.length === 0) return [];
  const { data, error: postsError } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", ids);
  if (postsError) throw friendlyError(postsError, "Couldn't load saved posts.");
  const byId = new Map(((data ?? []) as unknown as PostRow[]).map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is PostRow => !!p);
  return hydratePosts(ordered);
}

export async function fetchPostCounts(postId: string): Promise<PostCounts> {
  const { data, error } = await supabase
    .from("posts")
    .select("likes_count, comments_count, saves_count, reposts_count")
    .eq("id", postId)
    .maybeSingle();
  if (error || !data) throw friendlyError(error, "Couldn't refresh this post.");
  return {
    reactionsCount: data.likes_count,
    commentsCount: data.comments_count,
    savesCount: data.saves_count,
    sharesCount: data.reposts_count,
  };
}

export const postsKeys = {
  all: ["posts"] as const,
  feed: (mode: FeedMode) => ["posts", "feed", mode] as const,
  explore: (tag: string | null) => ["posts", "explore", tag ?? "all"] as const,
  user: (userId: string) => ["posts", "user", userId] as const,
  mentions: (username: string) => ["posts", "mentions", username.toLowerCase()] as const,
  saved: () => ["posts", "saved"] as const,
  comments: (postId: string) => ["post-comments", postId] as const,
};

export const feedQuery = (mode: FeedMode) =>
  queryOptions({ queryKey: postsKeys.feed(mode), queryFn: () => fetchFeed(mode) });
export const explorePostsQuery = (tag: string | null) =>
  queryOptions({ queryKey: postsKeys.explore(tag), queryFn: () => fetchExplorePosts(tag) });
export const userPostsQuery = (userId: string) =>
  queryOptions({ queryKey: postsKeys.user(userId), queryFn: () => fetchUserPosts(userId) });
export const mentionPostsQuery = (username: string) =>
  queryOptions({
    queryKey: postsKeys.mentions(username),
    queryFn: () => fetchMentionPosts(username),
  });
export const savedPostsQuery = () =>
  queryOptions({ queryKey: postsKeys.saved(), queryFn: fetchSavedPosts });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
export async function createPost(
  input: {
    content: string;
    files: File[];
    tags: string[];
    mood?: string | null | undefined;
    location?: string | null | undefined;
  },
  onProgress?: (progress: CreatePostProgress) => void,
): Promise<string> {
  const problem = validatePostDraft(input);
  if (problem) throw new Error(problem);
  const uid = await currentUserId();

  onProgress?.({
    stage: "preparing",
    percent: 10,
    message: "Preparing post draft...",
  });

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: uid,
      content: input.content.trim(),
      tags: input.tags,
      mood: input.mood || null,
      location: input.location || null,
    })
    .select("id")
    .single();
  if (error || !post) throw friendlyError(error, "Couldn't publish your post.");

  const uploaded: string[] = [];
  try {
    const processedFiles: {
      file: File;
      info: ReturnType<typeof detectMediaInfo>;
      originalSize: number;
    }[] = [];

    // Step 1: Pre-process & compress videos
    for (const [index, file] of input.files.entries()) {
      const info = detectMediaInfo(file);
      if (!info) {
        throw new Error(`File "${file.name}" is not a supported format.`);
      }

      if (info.type === "video") {
        onProgress?.({
          stage: "compressing",
          percent: 0,
          message: `Compressing video ${index + 1} of ${input.files.length} (H.264 / 720p)...`,
          bytesTotal: file.size,
        });

        const compResult = await compressVideo(
          file,
          { maxHeight: 720, maxFps: 30, quality: "medium" },
          (p) => {
            onProgress?.({
              stage: "compressing",
              percent: p,
              message: `Compressing video ${index + 1} of ${input.files.length} (${p}%)...`,
              bytesTotal: file.size,
            });
          },
        );

        processedFiles.push({
          file: compResult.file,
          info,
          originalSize: compResult.originalSize,
        });
      } else {
        processedFiles.push({
          file,
          info,
          originalSize: file.size,
        });
      }
    }

    // Step 2: Upload files (resumable TUS for videos, standard for images)
    const rows = [];
    const totalBytesAll = processedFiles.reduce((acc, f) => acc + f.file.size, 0);
    let cumulativeUploaded = 0;

    for (const [index, item] of processedFiles.entries()) {
      const { file, info } = item!;
      const ext = info!.ext;
      const path = `${uid}/${post.id}/${index}-${crypto.randomUUID()}.${ext}`;

      if (info!.type === "video") {
        onProgress?.({
          stage: "uploading",
          percent: Math.round((cumulativeUploaded / totalBytesAll) * 100),
          message: `Uploading video ${index + 1} of ${processedFiles.length}...`,
          bytesUploaded: cumulativeUploaded,
          bytesTotal: totalBytesAll,
        });

        await uploadResumableTus({
          bucket: BUCKET,
          path,
          file,
          onProgress(details) {
            const currentTotalUploaded = cumulativeUploaded + details.bytesUploaded;
            const overallPercent = Math.min(
              100,
              Math.round((currentTotalUploaded / totalBytesAll) * 100),
            );
            onProgress?.({
              stage: "uploading",
              percent: overallPercent,
              message: `Uploading media ${index + 1} of ${processedFiles.length} (${overallPercent}%)...`,
              bytesUploaded: currentTotalUploaded,
              bytesTotal: totalBytesAll,
            });
          },
        });
        cumulativeUploaded += file.size;
      } else {
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: info!.mime, upsert: false });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        cumulativeUploaded += file.size;
        const overallPercent = Math.min(
          100,
          Math.round((cumulativeUploaded / totalBytesAll) * 100),
        );
        onProgress?.({
          stage: "uploading",
          percent: overallPercent,
          message: `Uploading photo ${index + 1} of ${processedFiles.length}...`,
          bytesUploaded: cumulativeUploaded,
          bytesTotal: totalBytesAll,
        });
      }

      uploaded.push(path);
      rows.push({
        post_id: post.id,
        owner_id: uid,
        storage_path: path,
        media_type: info!.type,
        mime_type: info!.mime,
        size_bytes: file.size,
        position: index,
      });
    }

    // Step 3: Insert media rows
    onProgress?.({
      stage: "publishing",
      percent: 95,
      message: "Finalizing post and attachments...",
    });

    if (rows.length > 0) {
      const { error: mediaErr } = await supabase.from("post_media").insert(rows);
      if (mediaErr) throw friendlyError(mediaErr, "Couldn't attach media.");
    }

    onProgress?.({
      stage: "publishing",
      percent: 100,
      message: "Post published successfully!",
    });
  } catch (e) {
    // Roll back: remove uploaded files and the half-created post.
    if (uploaded.length > 0) await supabase.storage.from(BUCKET).remove(uploaded);
    await supabase.from("posts").delete().eq("id", post.id);
    throw e;
  }
  return post.id;
}

export async function updatePost(
  rowId: string,
  patch: { content?: string | undefined; repostNote?: string | null | undefined },
): Promise<void> {
  const update: { content?: string; repost_note?: string | null } = {};
  if (patch.content !== undefined) {
    const content = patch.content.trim();
    if (content.length > POST_LIMITS.maxContent) {
      throw new Error(`Posts can be up to ${POST_LIMITS.maxContent} characters.`);
    }
    update.content = content;
  }
  if (patch.repostNote !== undefined) {
    const note = patch.repostNote?.trim() || null;
    if (note && note.length > POST_LIMITS.maxRepostNote) {
      throw new Error(`Repost notes can be up to ${POST_LIMITS.maxRepostNote} characters.`);
    }
    update.repost_note = note;
  }
  const { data, error } = await supabase.from("posts").update(update).eq("id", rowId).select("id");
  if (error) throw friendlyError(error, "Couldn't update the post.");
  if (!data || data.length === 0) throw new Error("You can only edit your own posts.");
}

export async function deletePost(rowId: string): Promise<void> {
  const { data: media } = await supabase
    .from("post_media")
    .select("storage_path")
    .eq("post_id", rowId);
  const { data, error } = await supabase.from("posts").delete().eq("id", rowId).select("id");
  if (error) throw friendlyError(error, "Couldn't delete the post.");
  if (!data || data.length === 0) throw new Error("You can only delete your own posts.");
  const paths = (media ?? []).map((m) => m.storage_path);
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
}

export async function setPostLiked(postId: string, like: boolean): Promise<PostCounts> {
  const uid = await currentUserId();
  if (like) {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: uid });
    if (error && error.code !== "23505") throw friendlyError(error, "Couldn't like the post.");
  } else {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", uid);
    if (error) throw friendlyError(error, "Couldn't remove your like.");
  }
  return fetchPostCounts(postId);
}

export async function setPostSaved(postId: string, save: boolean): Promise<PostCounts> {
  const uid = await currentUserId();
  if (save) {
    const { error } = await supabase.from("post_saves").insert({ post_id: postId, user_id: uid });
    if (error && error.code !== "23505") throw friendlyError(error, "Couldn't save the post.");
  } else {
    const { error } = await supabase
      .from("post_saves")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", uid);
    if (error) throw friendlyError(error, "Couldn't remove the bookmark.");
  }
  return fetchPostCounts(postId);
}

export async function repostPost(postId: string, note?: string | undefined): Promise<void> {
  const uid = await currentUserId();
  const trimmed = note?.trim() || null;
  if (trimmed && trimmed.length > POST_LIMITS.maxRepostNote) {
    throw new Error(`Repost notes can be up to ${POST_LIMITS.maxRepostNote} characters.`);
  }
  const { error } = await supabase
    .from("posts")
    .insert({ author_id: uid, repost_of_id: postId, repost_note: trimmed });
  if (error?.code === "23505") throw new Error("You've already reposted this.");
  if (error) throw friendlyError(error, "Couldn't repost.");
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
  author: AuthorRow | null;
}

export async function fetchComments(postId: string): Promise<PostComment[]> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from("post_comments")
    .select(
      `id, post_id, parent_id, author_id, content, likes_count, created_at, updated_at,
       author:profiles!post_comments_author_id_fkey(id, username, display_name, avatar_url, points_balance)`,
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw friendlyError(error, "Couldn't load comments.");
  const rows = (data ?? []) as unknown as CommentRow[];
  const ids = rows.map((r) => r.id);
  let liked = new Set<string>();
  if (ids.length > 0) {
    const { data: likes, error: likesErr } = await supabase
      .from("post_comment_likes")
      .select("comment_id")
      .eq("user_id", uid)
      .in("comment_id", ids);
    if (likesErr) throw friendlyError(likesErr, "Couldn't load comments.");
    liked = new Set((likes ?? []).map((l) => l.comment_id));
  }
  return rows.map((r) => {
    const author = personFrom(r.author, r.author_id);
    return {
      id: r.id,
      postId: r.post_id,
      parentId: r.parent_id,
      authorId: author.id,
      authorName: author.name,
      authorUsername: author.username,
      authorAvatarUrl: author.avatarUrl,
      content: r.content,
      createdAt: r.created_at,
      isEdited: isEdited(r.created_at, r.updated_at),
      reactionsCount: r.likes_count,
      hasReacted: liked.has(r.id),
    };
  });
}

export const commentsQuery = (postId: string) =>
  queryOptions({ queryKey: postsKeys.comments(postId), queryFn: () => fetchComments(postId) });

function checkComment(content: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Write something first.");
  if (trimmed.length > POST_LIMITS.maxComment) {
    throw new Error(`Comments can be up to ${POST_LIMITS.maxComment} characters.`);
  }
  return trimmed;
}

export async function addComment(
  postId: string,
  content: string,
  parentId?: string | null | undefined,
): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase.from("post_comments").insert({
    post_id: postId,
    author_id: uid,
    parent_id: parentId ?? null,
    content: checkComment(content),
  });
  if (error?.code === "23503") throw new Error("That comment no longer exists.");
  if (error) throw friendlyError(error, "Couldn't add your comment.");
}

export async function editComment(commentId: string, content: string): Promise<void> {
  const { data, error } = await supabase
    .from("post_comments")
    .update({ content: checkComment(content) })
    .eq("id", commentId)
    .select("id");
  if (error) throw friendlyError(error, "Couldn't edit the comment.");
  if (!data || data.length === 0) throw new Error("You can only edit your own comments.");
}

export async function deleteComment(commentId: string): Promise<void> {
  const { data, error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .select("id");
  if (error) throw friendlyError(error, "Couldn't delete the comment.");
  if (!data || data.length === 0) throw new Error("You can only delete your own comments.");
}

export async function setCommentLiked(commentId: string, like: boolean): Promise<void> {
  const uid = await currentUserId();
  if (like) {
    const { error } = await supabase
      .from("post_comment_likes")
      .insert({ comment_id: commentId, user_id: uid });
    if (error && error.code !== "23505") throw friendlyError(error, "Couldn't like the comment.");
  } else {
    const { error } = await supabase
      .from("post_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", uid);
    if (error) throw friendlyError(error, "Couldn't remove your like.");
  }
}
