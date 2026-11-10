// Re-export persistent posts types for backward compatibility
export type {
  SocialPost,
  PostMedia,
  PostComment,
  PostPerson,
  PostCounts,
  FeedMode,
} from "@/services/posts";

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
  actorAvatarUrl?: string | null | undefined;
  targetId?: string | undefined;
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
  NOTIFICATIONS: "vidalore_social_notifications_v2",
  RELATIONSHIPS: "vidalore_social_relationships_v2",
  REPORTS: "vidalore_social_reports_v2",
};

// Local state helpers with safe empty fallbacks
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

export function getStoredNotifications(): SocialNotification[] {
  const notifs = getLocal<SocialNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
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

export function reportContent(report: {
  targetId: string;
  targetType: "post" | "comment" | "profile";
  reason: string;
  details?: string | undefined;
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
