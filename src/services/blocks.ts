import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BlockedUser {
  id: string;
  blockedId: string;
  blockedUsername: string;
  blockedDisplayName: string | null;
  blockedAvatarUrl: string | null;
  createdAt: string;
}

export const blocksKeys = {
  all: ["blocks"] as const,
  list: () => ["blocks", "list"] as const,
  ids: () => ["blocks", "ids"] as const,
};

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from("user_blocks")
    .select(
      `
      id,
      blocked_id,
      created_at,
      blocked:profiles!user_blocks_blocked_id_fkey(id, username, display_name, avatar_url)
    `,
    )
    .eq("blocker_id", uid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching blocked users:", error);
    return [];
  }

  interface BlockedRow {
    id: string;
    blocked_id: string;
    created_at: string;
    blocked: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  }

  return ((data || []) as unknown as BlockedRow[]).map((row) => ({
    id: row.id,
    blockedId: row.blocked_id,
    blockedUsername: row.blocked?.username || "user",
    blockedDisplayName: row.blocked?.display_name || null,
    blockedAvatarUrl: row.blocked?.avatar_url || null,
    createdAt: row.created_at,
  }));
}

export async function fetchBlockedUserIds(): Promise<string[]> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", uid);

  if (error) {
    console.error("Error fetching blocked user IDs:", error);
    return [];
  }

  return (data || []).map((row) => row.blocked_id);
}

export async function blockUser(targetUserId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error("Please sign in first.");
  if (uid === targetUserId) throw new Error("You cannot block yourself.");

  const { error } = await supabase.from("user_blocks").insert({
    blocker_id: uid,
    blocked_id: targetUserId,
  });

  if (error && error.code !== "23505") {
    // 23505 is unique violation (already blocked)
    throw new Error(error.message || "Failed to block user.");
  }
}

export async function unblockUser(targetUserId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error("Please sign in first.");

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", uid)
    .eq("blocked_id", targetUserId);

  if (error) {
    throw new Error(error.message || "Failed to unblock user.");
  }
}

export const blockedUsersQuery = () =>
  queryOptions({
    queryKey: blocksKeys.list(),
    queryFn: fetchBlockedUsers,
  });

export const blockedIdsQuery = () =>
  queryOptions({
    queryKey: blocksKeys.ids(),
    queryFn: fetchBlockedUserIds,
  });
