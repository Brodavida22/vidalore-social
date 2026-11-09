import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/services/profiles";

export interface PostMedia {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string;
  aspectRatio?: string;
  caption?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  parentId?: string | null;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
  reactionsCount: number;
  hasReacted?: boolean;
}

export interface SocialPost {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string | null;
  authorVerified?: boolean;
  authorPoints?: number;
  content: string;
  media?: PostMedia[];
  tags?: string[];
  mood?: string;
  location?: string;
  createdAt: string;
  reactionsCount: number;
  hasReacted?: boolean;
  commentsCount: number;
  sharesCount: number;
  hasShared?: boolean;
  savesCount: number;
  hasSaved?: boolean;
  isRepost?: boolean;
  repostNote?: string;
  originalAuthor?: {
    name: string;
    username: string;
    avatarUrl?: string | null;
  };
}

export interface SocialNotification {
  id: string;
  type:
    | "reaction"
    | "comment"
    | "reply"
    | "friend_request"
    | "friend_accept"
    | "follow"
    | "points"
    | "mention";
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorAvatarUrl?: string | null;
  targetId?: string;
  summary: string;
  createdAt: string;
  isRead: boolean;
}

export interface RelationshipState {
  following: string[]; // userIds
  followers: string[]; // userIds
  friends: string[]; // userIds
  incomingFriendRequests: string[]; // userIds
  outgoingFriendRequests: string[]; // userIds
  blockedUsers: string[]; // userIds
}

const STORAGE_KEYS = {
  POSTS: "vidalore_social_posts_v2",
  COMMENTS: "vidalore_social_comments_v2",
  NOTIFICATIONS: "vidalore_social_notifications_v2",
  RELATIONSHIPS: "vidalore_social_relationships_v2",
  REPORTS: "vidalore_social_reports_v2",
};

// Local state helpers with safe empty fallbacks (No mock or seed records)
function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, val: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new Event("vidalore:social-updated"));
  } catch {
    // quota exceeded or disabled
  }
}

export function getStoredPosts(): SocialPost[] {
  const posts = getLocal<SocialPost[]>(STORAGE_KEYS.POSTS, []);
  // Strip out any legacy mock seed posts
  return posts.filter((p) => !p.id.startsWith("post-seed-") && !p.authorId.startsWith("creator-"));
}

export function saveStoredPosts(posts: SocialPost[]): void {
  const clean = posts.filter(
    (p) => !p.id.startsWith("post-seed-") && !p.authorId.startsWith("creator-"),
  );
  setLocal(STORAGE_KEYS.POSTS, clean);
}

export function getStoredComments(): PostComment[] {
  const comments = getLocal<PostComment[]>(STORAGE_KEYS.COMMENTS, []);
  // Strip out any legacy mock comments
  return comments.filter(
    (c) => !c.authorId.startsWith("creator-") && !c.postId.startsWith("post-seed-"),
  );
}

export function saveStoredComments(comments: PostComment[]): void {
  const clean = comments.filter(
    (c) => !c.authorId.startsWith("creator-") && !c.postId.startsWith("post-seed-"),
  );
  setLocal(STORAGE_KEYS.COMMENTS, clean);
}

export function getStoredNotifications(): SocialNotification[] {
  const notifs = getLocal<SocialNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  // Strip out any legacy mock notifications
  return notifs.filter((n) => !n.id.startsWith("notif-") && !n.actorId.startsWith("creator-"));
}

export function saveStoredNotifications(notifs: SocialNotification[]): void {
  const clean = notifs.filter(
    (n) => !n.id.startsWith("notif-") && !n.actorId.startsWith("creator-"),
  );
  setLocal(STORAGE_KEYS.NOTIFICATIONS, clean);
}

export function getStoredRelationships(): RelationshipState {
  const rel = getLocal<RelationshipState>(STORAGE_KEYS.RELATIONSHIPS, {
    following: [],
    followers: [],
    friends: [],
    incomingFriendRequests: [],
    outgoingFriendRequests: [],
    blockedUsers: [],
  });
  // Strip any legacy mock creator IDs
  return {
    following: (rel.following || []).filter((id) => !id.startsWith("creator-")),
    followers: (rel.followers || []).filter((id) => !id.startsWith("creator-")),
    friends: (rel.friends || []).filter((id) => !id.startsWith("creator-")),
    incomingFriendRequests: (rel.incomingFriendRequests || []).filter(
      (id) => !id.startsWith("creator-"),
    ),
    outgoingFriendRequests: (rel.outgoingFriendRequests || []).filter(
      (id) => !id.startsWith("creator-"),
    ),
    blockedUsers: (rel.blockedUsers || []).filter((id) => !id.startsWith("creator-")),
  };
}

export function saveStoredRelationships(rel: RelationshipState): void {
  const clean: RelationshipState = {
    following: (rel.following || []).filter((id) => !id.startsWith("creator-")),
    followers: (rel.followers || []).filter((id) => !id.startsWith("creator-")),
    friends: (rel.friends || []).filter((id) => !id.startsWith("creator-")),
    incomingFriendRequests: (rel.incomingFriendRequests || []).filter(
      (id) => !id.startsWith("creator-"),
    ),
    outgoingFriendRequests: (rel.outgoingFriendRequests || []).filter(
      (id) => !id.startsWith("creator-"),
    ),
    blockedUsers: (rel.blockedUsers || []).filter((id) => !id.startsWith("creator-")),
  };
  setLocal(STORAGE_KEYS.RELATIONSHIPS, clean);
}

// Social Operations
export async function createPost(
  me: Profile,
  data: {
    content: string;
    media?: PostMedia[];
    tags?: string[];
    mood?: string;
    location?: string;
  },
): Promise<SocialPost> {
  const posts = getStoredPosts();
  const newPost: SocialPost = {
    id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    authorId: me.id,
    authorName: me.display_name || me.username,
    authorUsername: me.username,
    authorAvatarUrl: me.avatar_url,
    authorVerified: true,
    authorPoints: me.points_balance,
    content: data.content,
    media: data.media ?? [],
    tags: data.tags ?? [],
    mood: data.mood,
    location: data.location || me.location || undefined,
    createdAt: new Date().toISOString(),
    reactionsCount: 0,
    hasReacted: false,
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 0,
    hasSaved: false,
  };

  const updated = [newPost, ...posts];
  saveStoredPosts(updated);
  return newPost;
}

export function togglePostReaction(postId: string): SocialPost | undefined {
  const posts = getStoredPosts();
  const post = posts.find((p) => p.id === postId);
  if (!post) return undefined;

  const nextReacted = !post.hasReacted;
  post.hasReacted = nextReacted;
  post.reactionsCount = Math.max(0, post.reactionsCount + (nextReacted ? 1 : -1));
  saveStoredPosts([...posts]);
  return post;
}

export function togglePostSave(postId: string): boolean {
  const posts = getStoredPosts();
  const post = posts.find((p) => p.id === postId);
  if (!post) return false;

  const nextSaved = !post.hasSaved;
  post.hasSaved = nextSaved;
  post.savesCount = Math.max(0, post.savesCount + (nextSaved ? 1 : -1));
  saveStoredPosts([...posts]);
  return nextSaved;
}

export function addComment(
  me: Profile,
  postId: string,
  content: string,
  parentId?: string | null,
): PostComment {
  const comments = getStoredComments();
  const newComment: PostComment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    postId,
    parentId,
    authorId: me.id,
    authorName: me.display_name || me.username,
    authorUsername: me.username,
    authorAvatarUrl: me.avatar_url,
    content: content.trim(),
    createdAt: new Date().toISOString(),
    reactionsCount: 0,
    hasReacted: false,
  };

  saveStoredComments([...comments, newComment]);

  // increment post comments count
  const posts = getStoredPosts();
  const post = posts.find((p) => p.id === postId);
  if (post) {
    post.commentsCount += 1;
    saveStoredPosts([...posts]);
  }

  return newComment;
}

export function toggleCommentReaction(commentId: string): PostComment | undefined {
  const comments = getStoredComments();
  const comment = comments.find((c) => c.id === commentId);
  if (!comment) return undefined;

  const nextReacted = !comment.hasReacted;
  comment.hasReacted = nextReacted;
  comment.reactionsCount = Math.max(0, comment.reactionsCount + (nextReacted ? 1 : -1));
  saveStoredComments([...comments]);
  return comment;
}

export function deleteComment(commentId: string): void {
  const comments = getStoredComments();
  const comment = comments.find((c) => c.id === commentId);
  if (!comment) return;

  const postId = comment.postId;
  const filtered = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
  saveStoredComments(filtered);

  const posts = getStoredPosts();
  const post = posts.find((p) => p.id === postId);
  if (post && post.commentsCount > 0) {
    post.commentsCount = Math.max(0, post.commentsCount - 1);
    saveStoredPosts([...posts]);
  }
}

export function sharePost(
  me: Profile,
  postId: string,
  repostNote?: string,
): SocialPost | undefined {
  const posts = getStoredPosts();
  const original = posts.find((p) => p.id === postId);
  if (!original) return undefined;

  original.sharesCount += 1;
  original.hasShared = true;

  const repost: SocialPost = {
    id: `post-repost-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    authorId: me.id,
    authorName: me.display_name || me.username,
    authorUsername: me.username,
    authorAvatarUrl: me.avatar_url,
    authorVerified: true,
    authorPoints: me.points_balance,
    content: repostNote || `Echoed from @${original.authorUsername} in the Garden 🌹`,
    media: original.media,
    tags: original.tags,
    createdAt: new Date().toISOString(),
    reactionsCount: 0,
    hasReacted: false,
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 0,
    hasSaved: false,
    isRepost: true,
    repostNote,
    originalAuthor: {
      name: original.authorName,
      username: original.authorUsername,
      avatarUrl: original.authorAvatarUrl,
    },
  };

  saveStoredPosts([repost, ...posts]);
  return repost;
}

export function deletePost(postId: string): void {
  const posts = getStoredPosts().filter((p) => p.id !== postId);
  saveStoredPosts(posts);
}

export function reportContent(report: {
  targetId: string;
  targetType: "post" | "comment" | "profile";
  reason: string;
  details?: string;
}): void {
  const reports = getLocal<unknown[]>(STORAGE_KEYS.REPORTS, []);
  reports.push({
    id: `report-${Date.now()}`,
    ...report,
    createdAt: new Date().toISOString(),
  });
  setLocal(STORAGE_KEYS.REPORTS, reports);
}

export function toggleFollow(targetUserId: string): boolean {
  const rel = getStoredRelationships();
  const isFollowing = rel.following.includes(targetUserId);
  if (isFollowing) {
    rel.following = rel.following.filter((id) => id !== targetUserId);
  } else {
    rel.following.push(targetUserId);
  }
  saveStoredRelationships(rel);
  return !isFollowing;
}

export function sendFriendRequest(targetUserId: string): void {
  const rel = getStoredRelationships();
  if (!rel.outgoingFriendRequests.includes(targetUserId) && !rel.friends.includes(targetUserId)) {
    rel.outgoingFriendRequests.push(targetUserId);
    saveStoredRelationships(rel);
  }
}

export function acceptFriendRequest(targetUserId: string): void {
  const rel = getStoredRelationships();
  rel.incomingFriendRequests = rel.incomingFriendRequests.filter((id) => id !== targetUserId);
  if (!rel.friends.includes(targetUserId)) {
    rel.friends.push(targetUserId);
  }
  saveStoredRelationships(rel);
}

export function declineFriendRequest(targetUserId: string): void {
  const rel = getStoredRelationships();
  rel.incomingFriendRequests = rel.incomingFriendRequests.filter((id) => id !== targetUserId);
  saveStoredRelationships(rel);
}

export function removeFriend(targetUserId: string): void {
  const rel = getStoredRelationships();
  rel.friends = rel.friends.filter((id) => id !== targetUserId);
  saveStoredRelationships(rel);
}

export function blockUser(targetUserId: string): void {
  const rel = getStoredRelationships();
  if (!rel.blockedUsers.includes(targetUserId)) {
    rel.blockedUsers.push(targetUserId);
    rel.friends = rel.friends.filter((id) => id !== targetUserId);
    rel.following = rel.following.filter((id) => id !== targetUserId);
    saveStoredRelationships(rel);
  }
}

export function unblockUser(targetUserId: string): void {
  const rel = getStoredRelationships();
  rel.blockedUsers = rel.blockedUsers.filter((id) => id !== targetUserId);
  saveStoredRelationships(rel);
}

export function markNotificationRead(notifId: string): void {
  const notifs = getStoredNotifications();
  const n = notifs.find((item) => item.id === notifId);
  if (n) {
    n.isRead = true;
    saveStoredNotifications([...notifs]);
  }
}

export function markAllNotificationsRead(): void {
  const notifs = getStoredNotifications().map((n) => ({ ...n, isRead: true }));
  saveStoredNotifications(notifs);
}
