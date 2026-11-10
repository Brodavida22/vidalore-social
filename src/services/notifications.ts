import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PersistentNotification {
  id: string;
  recipientId: string;
  actorId: string;
  type:
    | "post_like"
    | "post_comment"
    | "comment_reply"
    | "comment_like"
    | "repost"
    | "follow"
    | "friend_request"
    | "friend_accept";
  postId?: string | null;
  commentId?: string | null;
  readAt?: string | null;
  createdAt: string;
  isRead: boolean;
  actor: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export const notificationsKeys = {
  all: ["notifications"] as const,
  list: () => ["notifications", "list"] as const,
  unreadCount: () => ["notifications", "unread-count"] as const,
};

export async function fetchNotifications(): Promise<PersistentNotification[]> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
      id,
      recipient_id,
      actor_id,
      type,
      post_id,
      comment_id,
      read_at,
      created_at,
      actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)
    `,
    )
    .eq("recipient_id", uid)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }

  interface NotificationRow {
    id: string;
    recipient_id: string;
    actor_id: string;
    type: string;
    post_id: string | null;
    comment_id: string | null;
    read_at: string | null;
    created_at: string;
    actor?: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  }

  return ((data || []) as unknown as NotificationRow[]).map((row) => ({
    id: row.id,
    recipientId: row.recipient_id,
    actorId: row.actor_id,
    type: row.type as PersistentNotification["type"],
    postId: row.post_id,
    commentId: row.comment_id,
    readAt: row.read_at,
    createdAt: row.created_at,
    isRead: Boolean(row.read_at),
    actor: {
      id: row.actor?.id || row.actor_id,
      username: row.actor?.username || "member",
      displayName: row.actor?.display_name || null,
      avatarUrl: row.actor?.avatar_url || null,
    },
  }));
}

export async function fetchUnreadNotificationsCount(): Promise<number> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", uid)
    .is("read_at", null);

  if (error) {
    console.error("Error fetching unread notification count:", error);
    return 0;
  }

  return count || 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", uid);

  if (error) {
    console.error("Failed to mark notification read:", error);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", uid)
    .is("read_at", null);

  if (error) {
    console.error("Failed to mark all notifications read:", error);
  }
}

export async function deleteNotification(id: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return;

  await supabase.from("notifications").delete().eq("id", id).eq("recipient_id", uid);
}

export const notificationsQuery = () =>
  queryOptions({
    queryKey: notificationsKeys.list(),
    queryFn: fetchNotifications,
  });

export const unreadNotificationsCountQuery = () =>
  queryOptions({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: fetchUnreadNotificationsCount,
  });
