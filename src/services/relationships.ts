
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type FriendRequest = Tables<"friend_requests">;

export type FriendRequestWithProfile = FriendRequest & {
  profile: Profile | null;
};

// ======================================================
// AUTH HELPER
// ======================================================

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("Please sign in first.");

  return data.user;
}

// ======================================================
// FOLLOW SYSTEM
// ======================================================

export async function followUser(userId: string) {
  const user = await getCurrentUser();

  if (user.id === userId) {
    throw new Error("You cannot follow yourself.");
  }

  // Prevent duplicate follow records
  const { data: existing, error: checkError } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", userId)
    .maybeSingle();

  if (checkError) throw checkError;

  if (existing) return;

  const { error } = await supabase.from("follows").insert({
    follower_id: user.id,
    following_id: userId,
  });

  // Ignore duplicate insertion caused by concurrent requests
  if (error && error.code === "23505") return;

  if (error) throw error;
}

export async function unfollowUser(userId: string) {
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", userId);

  if (error) throw error;
}

export async function isFollowing(userId: string): Promise<boolean> {
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;
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

// ======================================================
// FOLLOWERS
// ======================================================

export async function getFollowers(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId);

  if (error) throw error;

  const ids = [...new Set((data ?? []).map((item) => item.follower_id))];

  if (!ids.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);

  if (profileError) throw profileError;

  return profiles ?? [];
}

// ======================================================
// FOLLOWING
// ======================================================

export async function getFollowing(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) throw error;

  const ids = [...new Set((data ?? []).map((item) => item.following_id))];

  if (!ids.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);

  if (profileError) throw profileError;

  return profiles ?? [];
}

// ======================================================
// FOLLOW COUNTS
// ======================================================

export async function getFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId),

    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  if (followers.error) throw followers.error;
  if (following.error) throw following.error;

  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}

// ======================================================
// ACCEPTED FRIENDS
// ======================================================

export async function getFriends(): Promise<Profile[]> {
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!auth.user) return [];

  const userId = auth.user.id;

  const { data, error } = await supabase
    .from("friend_requests")
    .select("requester_id, recipient_id")
    .eq("status", "accepted")
    .or(
      `requester_id.eq.${userId},recipient_id.eq.${userId}`
    );

  if (error) throw error;

  const friendIds = [
    ...new Set(
      (data ?? []).map((request) =>
        request.requester_id === userId
          ? request.recipient_id
          : request.requester_id
      )
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

// ======================================================
// FRIEND REQUEST SYSTEM
// ======================================================

export async function sendFriendRequest(recipientId: string) {
  const user = await getCurrentUser();

  if (user.id === recipientId) {
    throw new Error("You cannot send a friend request to yourself.");
  }

  // Check whether a request or friendship already exists
  const { data: existing, error: checkError } = await supabase
    .from("friend_requests")
    .select("id, status, requester_id, recipient_id")
    .or(
      `and(requester_id.eq.${user.id},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${user.id})`
    )
    .in("status", ["pending", "accepted"])
    .limit(1)
    .maybeSingle();

  if (checkError) throw checkError;

  if (existing?.status === "accepted") {
    throw new Error("You are already friends.");
  }

  if (existing?.status === "pending") {
    throw new Error("A friend request already exists.");
  }

  const { error } = await supabase.from("friend_requests").insert({
    requester_id: user.id,
    recipient_id: recipientId,
    status: "pending",
  });

  if (error && error.code === "23505") {
    throw new Error("A friend request already exists.");
  }

  if (error) throw error;
}

// ======================================================
// ACCEPT FRIEND REQUEST
// ======================================================

export async function acceptFriendRequest(requestId: string) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("friend_requests")
    .update({
      status: "accepted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("recipient_id", user.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Friend request not found or already handled.");
  }

  return data;
}

// ======================================================
// DECLINE FRIEND REQUEST
// ======================================================

export async function declineFriendRequest(requestId: string) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("friend_requests")
    .update({
      status: "declined",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("recipient_id", user.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Friend request not found or already handled.");
  }

  return data;
}

// ======================================================
// CANCEL FRIEND REQUEST
// ======================================================

export async function cancelFriendRequest(requestId: string) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", requestId)
    .eq("requester_id", user.id)
    .eq("status", "pending")
    .select("id");

  if (error) throw error;

  if (!data?.length) {
    throw new Error("Pending friend request not found.");
  }
}

// ======================================================
// INCOMING FRIEND REQUESTS
// ======================================================

export async function getIncomingFriendRequests(): Promise<
  FriendRequestWithProfile[]
> {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("recipient_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const requests = data ?? [];

  if (!requests.length) return [];

  const profileIds = [...new Set(requests.map((r) => r.requester_id))];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", profileIds);

  if (profileError) throw profileError;

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  return requests.map((request) => ({
    ...request,
    profile: profileMap.get(request.requester_id) ?? null,
  }));
}

// ======================================================
// OUTGOING FRIEND REQUESTS
// ======================================================

export async function getOutgoingFriendRequests(): Promise<
  FriendRequestWithProfile[]
> {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("requester_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const requests = data ?? [];

  if (!requests.length) return [];

  const profileIds = [...new Set(requests.map((r) => r.recipient_id))];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", profileIds);

  if (profileError) throw profileError;

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  return requests.map((request) => ({
    ...request,
    profile: profileMap.get(request.recipient_id) ?? null,
  }));
}

// ======================================================
// FRIEND REQUEST STATUS
// ======================================================

export async function getFriendRequestStatus(
  userId: string
): Promise<FriendRequest | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .or(
      `and(requester_id.eq.${auth.user.id},recipient_id.eq.${userId}),and(requester_id.eq.${userId},recipient_id.eq.${auth.user.id})`
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}
