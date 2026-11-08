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

// High-fidelity seed posts embodying Vidalore's Rose Garden identity
const SEED_POSTS: SocialPost[] = [
  {
    id: "post-seed-1",
    authorId: "creator-celeste",
    authorName: "Celeste Moreau",
    authorUsername: "celeste",
    authorAvatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80",
    authorVerified: true,
    authorPoints: 1420,
    content:
      "Velvet midnight in the garden. Tonight the night-blooming roses released their deepest fragrance. There's something sacred about quiet hours when creativity finally breathes without haste. 🌹✨\n\nWho else finds solace under the starlight?",
    media: [
      {
        id: "m-1",
        type: "image",
        url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=85",
        caption: "Midnight crimson blooms under moonlight",
      },
    ],
    tags: ["RoseGarden", "VelvetHours", "NightBloom", "MidnightVibe"],
    mood: "🌙 Velvet Night",
    location: "The Rose Conservatory",
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    reactionsCount: 148,
    hasReacted: false,
    commentsCount: 24,
    sharesCount: 12,
    hasShared: false,
    savesCount: 39,
    hasSaved: false,
  },
  {
    id: "post-seed-2",
    authorId: "creator-raphael",
    authorName: "Raphaël Vance",
    authorUsername: "raphael",
    authorAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
    authorVerified: true,
    authorPoints: 980,
    content:
      "Golden hour styling series — capturing the interplay between deep burgundy velvet and subtle gold hardware. VIDALORE aesthetic in full bloom today.",
    media: [
      {
        id: "m-2",
        type: "image",
        url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&auto=format&fit=crop&q=85",
        caption: "Golden hour textures",
      },
      {
        id: "m-3",
        type: "image",
        url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=85",
        caption: "Elegance in shadows",
      },
    ],
    tags: ["VidaloreStyle", "Editorial", "Aesthetic", "RosePalette"],
    mood: "🍷 Elegant",
    location: "Milano, Italy",
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    reactionsCount: 89,
    hasReacted: true,
    commentsCount: 15,
    sharesCount: 8,
    hasShared: false,
    savesCount: 52,
    hasSaved: true,
  },
  {
    id: "post-seed-3",
    authorId: "creator-seraphina",
    authorName: "Seraphina Lin",
    authorUsername: "seraphina",
    authorAvatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80",
    authorVerified: false,
    authorPoints: 630,
    content:
      "New acoustic recording in the studio: 'Petals in the Dark'. Dedicated to everyone building in silence and creating their own garden. Listen with headphones for the binaural piano reverb. 🎹🌹",
    media: [
      {
        id: "m-4",
        type: "image",
        url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=85",
        caption: "Studio sessions under rose neon lights",
      },
    ],
    tags: ["OriginalMusic", "AcousticVibes", "CreativesOfVidalore"],
    mood: "✨ Radiant",
    location: "Studio Noir",
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    reactionsCount: 215,
    hasReacted: false,
    commentsCount: 42,
    sharesCount: 27,
    hasShared: false,
    savesCount: 78,
    hasSaved: false,
  },
];

const SEED_COMMENTS: PostComment[] = [
  {
    id: "c-1",
    postId: "post-seed-1",
    authorId: "creator-raphael",
    authorName: "Raphaël Vance",
    authorUsername: "raphael",
    authorAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
    content:
      "The contrast between the midnight gloom and that crimson glow is magnificent Celeste! 🌹",
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    reactionsCount: 14,
    hasReacted: true,
  },
  {
    id: "c-2",
    postId: "post-seed-1",
    parentId: "c-1",
    authorId: "creator-celeste",
    authorName: "Celeste Moreau",
    authorUsername: "celeste",
    authorAvatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80",
    content: "Thank you Raphaël! That gentle dew helped capture the light just right. 🖤",
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    reactionsCount: 6,
    hasReacted: false,
  },
  {
    id: "c-3",
    postId: "post-seed-2",
    authorId: "creator-seraphina",
    authorName: "Seraphina Lin",
    authorUsername: "seraphina",
    authorAvatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80",
    content: "That silhouette in the second slide is pure cinematic art. Stunning palette! 👏",
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    reactionsCount: 8,
    hasReacted: false,
  },
];

const SEED_NOTIFICATIONS: SocialNotification[] = [
  {
    id: "notif-1",
    type: "reaction",
    actorId: "creator-celeste",
    actorName: "Celeste Moreau",
    actorUsername: "celeste",
    actorAvatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80",
    targetId: "post-seed-2",
    summary: "reacted with a Rose 🌹 to your post",
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    isRead: false,
  },
  {
    id: "notif-2",
    type: "comment",
    actorId: "creator-raphael",
    actorName: "Raphaël Vance",
    actorUsername: "raphael",
    actorAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
    targetId: "post-seed-1",
    summary: 'commented: "The contrast between the midnight gloom and that crimson glow..."',
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    isRead: false,
  },
  {
    id: "notif-3",
    type: "points",
    actorId: "system-vidalore",
    actorName: "VIDALORE SOCIAL",
    actorUsername: "vidalore",
    actorAvatarUrl: "/favicon.png",
    summary: "awarded you +25 VIDA POINTS for daily bloom activity 🌹",
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    isRead: true,
  },
  {
    id: "notif-4",
    type: "follow",
    actorId: "creator-seraphina",
    actorName: "Seraphina Lin",
    actorUsername: "seraphina",
    actorAvatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80",
    summary: "started following your garden",
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    isRead: true,
  },
];

// Local state helpers with safe fallback
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
  return getLocal<SocialPost[]>(STORAGE_KEYS.POSTS, SEED_POSTS);
}

export function saveStoredPosts(posts: SocialPost[]): void {
  setLocal(STORAGE_KEYS.POSTS, posts);
}

export function getStoredComments(): PostComment[] {
  return getLocal<PostComment[]>(STORAGE_KEYS.COMMENTS, SEED_COMMENTS);
}

export function saveStoredComments(comments: PostComment[]): void {
  setLocal(STORAGE_KEYS.COMMENTS, comments);
}

export function getStoredNotifications(): SocialNotification[] {
  return getLocal<SocialNotification[]>(STORAGE_KEYS.NOTIFICATIONS, SEED_NOTIFICATIONS);
}

export function saveStoredNotifications(notifs: SocialNotification[]): void {
  setLocal(STORAGE_KEYS.NOTIFICATIONS, notifs);
}

export function getStoredRelationships(): RelationshipState {
  return getLocal<RelationshipState>(STORAGE_KEYS.RELATIONSHIPS, {
    following: ["creator-celeste", "creator-raphael"],
    followers: ["creator-seraphina"],
    friends: ["creator-raphael"],
    incomingFriendRequests: ["creator-celeste"],
    outgoingFriendRequests: [],
    blockedUsers: [],
  });
}

export function saveStoredRelationships(rel: RelationshipState): void {
  setLocal(STORAGE_KEYS.RELATIONSHIPS, rel);
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
