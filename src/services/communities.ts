
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Community = Tables<"communities">;
export type CommunityMember = Tables<"community_members">;
export type CommunityPost = Tables<"community_posts">;

export type CommunityWithOwner = Community & {
  owner: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  member_count: number;
};

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("Please sign in first.");

  return data.user;
}

// ================================================
// DISCOVER COMMUNITIES
// ================================================

export async function getCommunities(): Promise<CommunityWithOwner[]> {
  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .eq("privacy", "public")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const communities = data ?? [];

  if (!communities.length) return [];

  const ids = communities.map((community) => community.id);

  const { data: members, error: membersError } = await supabase
    .from("community_members")
    .select("community_id")
    .in("community_id", ids);

  if (membersError) throw membersError;

  const ownerIds = [...new Set(communities.map((community) => community.owner_id))];
  const { data: owners, error: ownersError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", ownerIds);

  if (ownersError) throw ownersError;

  const ownerMap = new Map((owners ?? []).map((owner) => [owner.id, owner]));

  const counts = new Map<string, number>();

  for (const member of members ?? []) {
    counts.set(
      member.community_id,
      (counts.get(member.community_id) ?? 0) + 1
    );
  }

  return communities.map((community) => ({
    ...community,
    owner: ownerMap.get(community.owner_id) ?? null,
    member_count: counts.get(community.id) ?? 0,
  }));
}

// ================================================
// GET COMMUNITY BY SLUG
// ================================================

export async function getCommunityBySlug(
  slug: string
): Promise<Community | null> {
  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;

  return data;
}

// ================================================
// CREATE COMMUNITY
// ================================================

export async function createCommunity(input: {
  name: string;
  slug: string;
  description?: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  privacy?: "public" | "private";
}): Promise<Community> {
  const user = await getCurrentUser();

  const name = input.name.trim();
  const slug = input.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (name.length < 3) {
    throw new Error("Community name must be at least 3 characters.");
  }

  if (!slug) {
    throw new Error("Please provide a valid community URL.");
  }

  const { data, error } = await supabase
    .from("communities")
    .insert({
      name,
      slug,
      description: input.description?.trim() ?? "",
      avatar_url: input.avatar_url ?? null,
      cover_url: input.cover_url ?? null,
      owner_id: user.id,
      privacy: input.privacy ?? "public",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("This community URL is already taken.");
    }

    throw error;
  }

  return data;
}

// ================================================
// JOIN COMMUNITY
// ================================================

export async function joinCommunity(
  communityId: string
): Promise<void> {
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("community_members")
    .insert({
      community_id: communityId,
      user_id: user.id,
      role: "member",
    });

  if (error && error.code === "23505") return;

  if (error) throw error;
}

// ================================================
// LEAVE COMMUNITY
// ================================================

export async function leaveCommunity(
  communityId: string
): Promise<void> {
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .neq("role", "owner");

  if (error) throw error;
}

// ================================================
// GET MY COMMUNITIES
// ================================================

export async function getMyCommunities(): Promise<Community[]> {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", user.id);

  if (error) throw error;

  const ids = [...new Set((data ?? []).map((item) => item.community_id))];

  if (!ids.length) return [];

  const { data: communities, error: communitiesError } = await supabase
    .from("communities")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (communitiesError) throw communitiesError;

  return communities ?? [];
}

// ================================================
// CHECK MEMBERSHIP
// ================================================

export async function isCommunityMember(
  communityId: string
): Promise<boolean> {
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!auth.user) return false;

  const { data, error } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", communityId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data);
}

// ================================================
// COMMUNITY MEMBERS
// ================================================

export async function getCommunityMembers(
  communityId: string
) {
  const { data, error } = await supabase
    .from("community_members")
    .select(`
      *,
      profile:profiles!community_members_user_id_fkey(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq("community_id", communityId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

// ================================================
// COMMUNITY POSTS
// ================================================

export async function getCommunityPosts(
  communityId: string
): Promise<CommunityPost[]> {
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

// ================================================
// CREATE COMMUNITY POST
// ================================================

export async function createCommunityPost(input: {
  communityId: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
}): Promise<CommunityPost> {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      community_id: input.communityId,
      author_id: user.id,
      content: input.content.trim(),
      media_url: input.media_url ?? null,
      media_type: input.media_type ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}
