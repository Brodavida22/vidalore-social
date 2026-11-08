import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type FriendRequest = Tables<"friend_requests">;

export type FriendRequestWithProfile = FriendRequest & {
  profile: Profile | null;
};

// ==========================================
// FOLLOW SYSTEM
// ==========================================

export async function followUser(userId: string) {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) throw new Error("Please sign in first.");
  if (auth.user.id === userId) {
    throw new Error("You cannot follow yourself.");
  }

  const { error } = await supabase.from("follows").insert({
    follower_id: auth.user.id,
    following_id: userId,
  });

  if (error) throw error;
}

export async function unfollowUser(userId: string) {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) throw new Error("Please sign in first.");

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", auth.user.id)
    .eq("following_id", userId);

  if (error) throw error;
}

export async function isFollowing(userId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return false;

  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", auth.user.id)
    .eq("following_id", userId)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data);
}

export async function getFollowers(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId);

  if (error) throw error;

  const ids = (data ?? []).map((item) => item.follower_id);

  if (!ids.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);

  if (profileError) throw profileError;

  return profiles ?? [];
}

export async function getFollowing(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) throw error;

  const ids = (data ?? []).map((item) => item.following_id);

  if (!ids.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);

  if (profileError) throw profileError;

  return profiles ?? [];
}

export async function getFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),

    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);

  if (followers.error) throw followers.error;
  if (following.error) throw following.error;

  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}

// ==========================================
// ACCEPTED FRIENDS
// ==========================================

export async function getFriends(): Promise<Profile[]> {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return [];

  const userId = auth.user.id;

  const { data, error } = await supabase
    .from("friend_requests")
    .select("requester_id, recipient_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

  if (error) throw error;

  const friendIds = [
    ...new Set(
      (data ?? []).map((request) =>
        request.requester_id === userId ? request.recipient_id : request.requester_id,
      ),
    ),
  ];

  if (!friendIds.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", friendIds);

  if (profileError) throw profileError;

  return profiles ?? [];
}

// ==========================================
// FRIEND REQUEST SYSTEM
// ==========================================

export async function sendFriendRequest(recipientId: string) {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) throw new Error("Please sign in first.");

  if (auth.user.id === recipientId) {
    throw new Error("You cannot send a friend request to yourself.");
  }

  const { error } = await supabase.from("friend_requests").insert({
    requester_id: auth.user.id,
    recipient_id: recipientId,
    status: "pending",
  });

  if (error) throw error;
}

export async function acceptFriendRequest(requestId: string) {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) throw new Error("Please sign in first.");

  const { data, error } = await supabase
    .from("friend_requests")
    .update({
      status: "accepted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("recipient_id", auth.user.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Friend request not found or already handled.");
  }

  return data;
}

export async function declineFriendRequest(requestId: string) {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) throw new Error("Please sign in first.");

  const { data, error } = await supabase
    .from("friend_requests")
    .update({
      status: "declined",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("recipient_id", auth.user.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Friend request not found or already handled.");
  }

  return data;
}

export async function cancelFriendRequest(requestId: string) {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) throw new Error("Please sign in first.");

  const { error, count } = await supabase
    .from("friend_requests")
    .delete({ count: "exact" })
    .eq("id", requestId)
    .eq("requester_id", auth.user.id)
    .eq("status", "pending");

  if (error) throw error;

  if (count === 0) {
    throw new Error("Pending friend request not found.");
  }
}

// ==========================================
// INCOMING FRIEND REQUESTS
// ==========================================

export async function getIncomingFriendRequests(): Promise<FriendRequestWithProfile[]> {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return [];

  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("recipient_id", auth.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const requests = data ?? [];

  if (!requests.length) return [];

  const ids = requests.map((request) => request.requester_id);

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);

  if (profileError) throw profileError;

  return requests.map((request) => ({
    ...request,
    profile: profiles?.find((profile) => profile.id === request.requester_id) ?? null,
  }));
}

// ==========================================
// OUTGOING FRIEND REQUESTS
// ==========================================

export async function getOutgoingFriendRequests(): Promise<FriendRequestWithProfile[]> {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return [];

  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("requester_id", auth.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const requests = data ?? [];

  if (!requests.length) return [];

  const ids = requests.map((request) => request.recipient_id);

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);

  if (profileError) throw profileError;

  return requests.map((request) => ({
    ...request,
    profile: profiles?.find((profile) => profile.id === request.recipient_id) ?? null,
  }));
}

// ==========================================
// FRIEND REQUEST STATUS
// ==========================================

export async function getFriendRequestStatus(userId: string) {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .or(
      `and(requester_id.eq.${auth.user.id},recipient_id.eq.${userId}),and(requester_id.eq.${userId},recipient_id.eq.${auth.user.id})`,
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}
