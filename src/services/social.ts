import type {
  SocialPost,
  PostMedia,
  PostComment,
  PostPerson,
  PostCounts,
  FeedMode,
} from "@/services/posts";

export type { SocialPost, PostMedia, PostComment, PostPerson, PostCounts, FeedMode };

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
  following: string[];
  followers: string[];
  friends: string[];
  incomingFriendRequests: string[];
  outgoingFriendRequests: string[];
  blockedUsers: string[];
}

const STORAGE_KEYS = {
  NOTIFICATIONS: "vidalore_social_notifications_v2",
  REPORTS: "vidalore_social_reports_v2",
};

function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("vidalore:social-updated"));
  } catch {
    // Storage may be unavailable or full.
  }
}

/**
 * Relationship information must now come from Supabase.
 * This compatibility function intentionally returns an empty state.
 * Do not use it to determine real follow/friend/block status.
 */
export function getStoredRelationships(): RelationshipState {
  return {
    following: [],
    followers: [],
    friends: [],
    incomingFriendRequests: [],
    outgoingFriendRequests: [],
    blockedUsers: [],
  };
}

/**
 * Deprecated compatibility function.
 * Follow operations must use services/relationships.ts.
 */
export function toggleFollow(_targetUserId: string): boolean {
  throw new Error(
    "Local follow storage is disabled. Use followUser/unfollowUser from services/relationships.ts.",
  );
}

/**
 * Deprecated compatibility function.
 * Friend requests must use services/relationships.ts.
 */
export function sendFriendRequest(_targetUserId: string): void {
  throw new Error(
    "Local friend requests are disabled. Use sendFriendRequest from services/relationships.ts.",
  );
}

export function getStoredNotifications(): SocialNotification[] {
  const notifications = getLocal<SocialNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);

  return notifications.filter(
    (notification) =>
      !notification.id.startsWith("notif-") && !notification.actorId.startsWith("creator-"),
  );
}

export function saveStoredNotifications(notifications: SocialNotification[]): void {
  const clean = notifications.filter(
    (notification) =>
      !notification.id.startsWith("notif-") && !notification.actorId.startsWith("creator-"),
  );

  setLocal(STORAGE_KEYS.NOTIFICATIONS, clean);
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

export function markNotificationRead(notificationId: string): void {
  const notifications = getStoredNotifications();
  const notification = notifications.find((item) => item.id === notificationId);

  if (!notification) return;

  notification.isRead = true;
  saveStoredNotifications(notifications);
}

export function markAllNotificationsRead(): void {
  saveStoredNotifications(
    getStoredNotifications().map((notification) => ({
      ...notification,
      isRead: true,
    })),
  );
}
