import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type SupabaseRpcCaller = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

const callGroupRpc = (fn: string, args: Record<string, unknown>) =>
  (supabase as unknown as SupabaseRpcCaller).rpc(fn, args);

export type Conversation = Tables<"conversations">;
export type ConversationMember = Tables<"conversation_members">;
export type Message = Tables<"messages">;
export type Profile = Tables<"profiles">;
export type MessageRead = Tables<"message_reads">;
export type MessageReaction = Tables<"message_reactions"> & {
  profile?: Profile | null;
};

export type MessageWithReadsAndReactions = Message & {
  reads?: MessageRead[];
  reactions?: MessageReaction[];
  replyToMessage?: Message | null;
  sender?: Profile | null;
};

// Backwards compatibility alias
export type MessageWithReads = MessageWithReadsAndReactions;

export type ConversationListItem = Conversation & {
  members: Array<
    ConversationMember & {
      profile: Profile | null;
    }
  >;
  lastMessage: Message | null;
  unreadCount?: number;
};

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("You must be logged in.");

  return data.user;
}

type ConversationSettings = {
  cleared_at: string | null;
  hidden_at: string | null;
};

/**
 * Read the signed-in user's own clear/hide settings for one conversation.
 */
async function getMyConversationSettings(
  conversationId: string,
): Promise<ConversationSettings | null> {
  const user = await getCurrentUser();

  const { data, error } = await (supabase as any)
    .from("conversation_members")
    .select("cleared_at, hidden_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return (data as ConversationSettings | null) ?? null;
}

/**
 * Update only the signed-in user's own clear/hide settings.
 */
async function updateMyConversationSettings(
  conversationId: string,
  settings: Partial<ConversationSettings>,
): Promise<void> {
  const user = await getCurrentUser();

  const { error } = await (supabase as any)
    .from("conversation_members")
    .update(settings)
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  if (error) throw error;
}

export function getPerUserClearedTimestamp(userId: string, conversationId: string): number {
  if (typeof window === "undefined" || !userId || !conversationId) return 0;
  try {
    const val = localStorage.getItem(`vidalore_cleared_at_${userId}_${conversationId}`);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export function setPerUserClearedTimestamp(
  userId: string,
  conversationId: string,
  timestamp: number,
): void {
  if (typeof window === "undefined" || !userId || !conversationId) return;
  try {
    localStorage.setItem(`vidalore_cleared_at_${userId}_${conversationId}`, String(timestamp));
  } catch {
    // Ignore storage errors
  }
}

export function getPerUserDeletedMessageIds(userId: string): Set<string> {
  if (typeof window === "undefined" || !userId) return new Set();
  try {
    const raw = localStorage.getItem(`vidalore_deleted_for_me_${userId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function addPerUserDeletedMessageId(userId: string, messageId: string): void {
  if (typeof window === "undefined" || !userId || !messageId) return;
  try {
    const set = getPerUserDeletedMessageIds(userId);
    set.add(messageId);
    localStorage.setItem(`vidalore_deleted_for_me_${userId}`, JSON.stringify([...set]));
  } catch {
    // Ignore storage errors
  }
}

export function getPerUserHiddenConversations(userId: string): Record<string, number> {
  if (typeof window === "undefined" || !userId) return {};
  try {
    const raw = localStorage.getItem(`vidalore_hidden_conversations_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setPerUserHiddenConversation(
  userId: string,
  conversationId: string,
  hiddenAt: number,
): void {
  if (typeof window === "undefined" || !userId || !conversationId) return;
  try {
    const map = getPerUserHiddenConversations(userId);
    map[conversationId] = hiddenAt;
    localStorage.setItem(`vidalore_hidden_conversations_${userId}`, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export function unhideConversationForUser(userId: string, conversationId: string): void {
  if (typeof window === "undefined" || !userId || !conversationId) return;
  try {
    const map = getPerUserHiddenConversations(userId);
    delete map[conversationId];
    localStorage.setItem(`vidalore_hidden_conversations_${userId}`, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load all conversations belonging to the signed-in user with member details,
 * last message, and unread counts.
 */
export async function getMyConversations(): Promise<ConversationListItem[]> {
  const user = await getCurrentUser();

  const { data: memberships, error: membershipError } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("user_id", user.id);

  if (membershipError) throw membershipError;

  const conversationIds = [...new Set((memberships ?? []).map((item) => item.conversation_id))];

  if (conversationIds.length === 0) return [];

  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("*")
    .in("id", conversationIds)
    .order("last_message_at", {
      ascending: false,
      nullsFirst: false,
    });

  if (conversationsError) throw conversationsError;

  // Read this user's settings from their own conversation membership rows.
  const settingsMap = new Map<string, ConversationSettings>(
    (memberships ?? []).map((membership) => [
      membership.conversation_id,
      membership as unknown as ConversationSettings,
    ] as const),
  );

  // Keep hidden conversations out of this user's list until a newer message arrives.
  const activeConversations = (conversations ?? []).filter((conv) => {
    const hiddenAt = settingsMap.get(conv.id)?.hidden_at;
    if (!hiddenAt) return true;
    if (!conv.last_message_at) return false;

    return new Date(conv.last_message_at).getTime() >
      new Date(hiddenAt).getTime();
  });

  const activeConvIds = activeConversations.map((c) => c.id);
  if (activeConvIds.length === 0) return [];

  const { data: members, error: membersError } = await supabase
    .from("conversation_members")
    .select("*")
    .in("conversation_id", activeConvIds);

  if (membersError) throw membersError;

  const profileIds = [...new Set((members ?? []).map((member) => member.user_id))];

  let profiles: Profile[] = [];

  if (profileIds.length > 0) {
    const { data, error } = await supabase.from("profiles").select("*").in("id", profileIds);

    if (error) throw error;
    profiles = data ?? [];
  }

  const { data: recentMessages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", activeConvIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (messagesError) throw messagesError;

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const lastMessageMap = new Map<string, Message>();
  const membershipMap = new Map(memberships?.map((m) => [m.conversation_id, m]) ?? []);

  const deletedForMe = getPerUserDeletedMessageIds(user.id);

  // Compute unread counts and last message for each conversation
  const unreadCountMap = new Map<string, number>();

  for (const message of recentMessages ?? []) {
    if (deletedForMe.has(message.id)) continue;

    const clearedAt = settingsMap.get(message.conversation_id)?.cleared_at;
    if (
      clearedAt &&
      new Date(message.created_at).getTime() <= new Date(clearedAt).getTime()
    ) {
      continue;
    }

    if (!lastMessageMap.has(message.conversation_id)) {
      lastMessageMap.set(message.conversation_id, message);
    }

    const myMembership = membershipMap.get(message.conversation_id);
    if (message.sender_id !== user.id && !message.deleted_at) {
      const lastReadAt = myMembership?.last_read_at
        ? new Date(myMembership.last_read_at).getTime()
        : 0;
      const msgTime = new Date(message.created_at).getTime();
      if (msgTime > lastReadAt) {
        unreadCountMap.set(
          message.conversation_id,
          (unreadCountMap.get(message.conversation_id) ?? 0) + 1,
        );
      }
    }
  }

  return activeConversations.map((conversation) => ({
    ...conversation,
    members: (members ?? [])
      .filter((member) => member.conversation_id === conversation.id)
      .map((member) => ({
        ...member,
        profile: profileMap.get(member.user_id) ?? null,
      })),
    lastMessage: lastMessageMap.get(conversation.id) ?? null,
    unreadCount: unreadCountMap.get(conversation.id) ?? 0,
  }));
}

/**
 * Load messages from one conversation, including reads, reactions, replied-to messages, and senders.
 */
export async function getConversationMessages(
  conversationId: string,
  limit = 100,
  beforeCreatedAt?: string,
): Promise<MessageWithReadsAndReactions[]> {
  const user = await getCurrentUser().catch(() => null);

  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (beforeCreatedAt) {
    query = query.lt("created_at", beforeCreatedAt);
  }

  const { data: rawMessages, error } = await query;

  if (error) throw error;
  if (!rawMessages || rawMessages.length === 0) return [];

  // Filter messages for this user based on Delete For Me and database-backed Clear Chat.
  const deletedForMe = user
    ? getPerUserDeletedMessageIds(user.id)
    : new Set<string>();

  const settings = user
    ? await getMyConversationSettings(conversationId)
    : null;

  const clearedAt = settings?.cleared_at
    ? new Date(settings.cleared_at).getTime()
    : 0;

  const messages = rawMessages.filter((m) => {
    if (deletedForMe.has(m.id)) return false;
    if (clearedAt > 0 && new Date(m.created_at).getTime() <= clearedAt) return false;
    return true;
  });

  if (messages.length === 0) return [];

  const messageIds = messages.map((item) => item.id);
  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  const replyToIds = messages.map((m) => m.reply_to_id).filter((id): id is string => Boolean(id));

  // Parallel fetching of reads, reactions, senders, and reply targets
  const [readsResult, reactionsResult, sendersResult, repliesResult] = await Promise.all([
    supabase.from("message_reads").select("*").in("message_id", messageIds),
    supabase.from("message_reactions").select("*").in("message_id", messageIds),
    supabase.from("profiles").select("*").in("id", senderIds),
    replyToIds.length > 0
      ? supabase.from("messages").select("*").in("id", replyToIds)
      : Promise.resolve({ data: [] as Message[], error: null }),
  ]);

  if (readsResult.error) {
    console.warn("VIDALORE GET MESSAGE READS WARNING:", readsResult.error);
  }
  if (reactionsResult.error) {
    console.warn("VIDALORE GET MESSAGE REACTIONS WARNING:", reactionsResult.error);
  }

  const readsMap = new Map<string, MessageRead[]>();
  for (const read of readsResult.data ?? []) {
    const list = readsMap.get(read.message_id) ?? [];
    list.push(read);
    readsMap.set(read.message_id, list);
  }

  // Load profiles for react users if any
  const reactionUserIds = [...new Set((reactionsResult.data ?? []).map((r) => r.user_id))];
  let reactionProfiles: Profile[] = [];
  if (reactionUserIds.length > 0) {
    const { data: rProfiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", reactionUserIds);
    reactionProfiles = rProfiles ?? [];
  }
  const reactionProfileMap = new Map(reactionProfiles.map((p) => [p.id, p]));

  const reactionsMap = new Map<string, MessageReaction[]>();
  for (const reaction of reactionsResult.data ?? []) {
    const list = reactionsMap.get(reaction.message_id) ?? [];
    list.push({
      ...reaction,
      profile: reactionProfileMap.get(reaction.user_id) ?? null,
    });
    reactionsMap.set(reaction.message_id, list);
  }

  const senderProfileMap = new Map((sendersResult.data ?? []).map((p) => [p.id, p]));
  const replyMap = new Map((repliesResult.data ?? []).map((m) => [m.id, m]));

  return messages.map((message) => ({
    ...message,
    reads: readsMap.get(message.id) ?? [],
    reactions: reactionsMap.get(message.id) ?? [],
    sender: senderProfileMap.get(message.sender_id) ?? null,
    replyToMessage: message.reply_to_id ? (replyMap.get(message.reply_to_id) ?? null) : null,
  }));
}

/**
 * Create a direct conversation with another user.
 */
export async function createDirectConversation(otherUserId: string): Promise<Conversation> {
  const user = await getCurrentUser();

  if (user.id === otherUserId) {
    throw new Error("You cannot start a conversation with yourself.");
  }

  // Check whether a direct conversation already exists.
  const { data: ownMemberships, error: ownError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", user.id);

  if (ownError) throw ownError;

  const ownConversationIds = [
    ...new Set((ownMemberships ?? []).map((item) => item.conversation_id)),
  ];

  if (ownConversationIds.length > 0) {
    const { data: sharedMemberships, error: sharedError } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", ownConversationIds);

    if (sharedError) throw sharedError;

    const sharedIds = [...new Set((sharedMemberships ?? []).map((item) => item.conversation_id))];

    if (sharedIds.length > 0) {
      const { data: existing, error: existingError } = await supabase
        .from("conversations")
        .select("*")
        .eq("kind", "direct")
        .in("id", sharedIds)
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return existing;
    }
  }

  const conversationId = crypto.randomUUID();

  const { error: conversationError } = await supabase.from("conversations").insert({
    id: conversationId,
    kind: "direct",
    created_by: user.id,
    last_message_at: new Date().toISOString(),
  });

  if (conversationError) {
    console.error("VIDALORE CONVERSATION INSERT ERROR:", conversationError);
    throw conversationError;
  }

  const { error: membersError } = await supabase.from("conversation_members").insert([
    {
      conversation_id: conversationId,
      user_id: user.id,
      role: "member",
    },
    {
      conversation_id: conversationId,
      user_id: otherUserId,
      role: "member",
    },
  ]);

  if (membersError) {
    console.error("VIDALORE MEMBERS INSERT ERROR:", membersError);
    throw new Error(
      `Failed to add conversation members: ${membersError.message || "Database permission denied"}`,
    );
  }

  const { data: conversation, error: fetchError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (fetchError || !conversation) {
    throw fetchError || new Error("Conversation was created, but could not be retrieved.");
  }

  return conversation;
}

/**
 * Create a new group conversation with title, members, and optional group image.
 */
export async function createGroupConversation(
  title: string,
  memberUserIds: string[],
  imageUrl?: string,
): Promise<Conversation> {
  const user = await getCurrentUser();
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error("Group name is required.");
  }

  const conversationId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 1. Insert conversation with kind 'group'
  const { error: convError } = await supabase.from("conversations").insert({
    id: conversationId,
    kind: "group",
    title: cleanTitle,
    image_url: imageUrl || null,
    created_by: user.id,
    last_message_at: now,
  });

  if (convError) {
    console.error("CREATE GROUP CONVERSATION ERROR:", convError);
    throw convError;
  }

  // 2. Members: Creator is the persistent 'owner', other invited users are 'member'
  const uniqueMemberIds = [...new Set(memberUserIds.filter((id) => id !== user.id))];

  const memberRows: Array<{
    conversation_id: string;
    user_id: string;
    role: "owner" | "member";
    joined_at: string;
  }> = [
    {
      conversation_id: conversationId,
      user_id: user.id,
      role: "owner",
      joined_at: now,
    },
    ...uniqueMemberIds.map((memberId) => ({
      conversation_id: conversationId,
      user_id: memberId,
      role: "member" as const,
      joined_at: now,
    })),
  ];

  const { error: membersError } = await supabase.from("conversation_members").insert(memberRows);

  if (membersError) {
    console.error("CREATE GROUP MEMBERS ERROR:", membersError);
    throw membersError;
  }

  // Initial system message announcing group creation
  try {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: `created group "${cleanTitle}"`,
      message_type: "text",
    });
  } catch (err) {
    console.warn("Could not insert initial group message:", err);
  }

  const { data: conversation, error: fetchError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (fetchError || !conversation) {
    throw fetchError || new Error("Group was created, but could not be loaded.");
  }

  return conversation;
}

/**
 * Update group details (title, image) - only group admins permitted.
 */
export async function updateGroupConversation(
  conversationId: string,
  updates: { title?: string; image_url?: string | null },
): Promise<Conversation> {
  const user = await getCurrentUser();

  // The owner is identified by conversations.created_by; admins are stored in membership roles.
  const [{ data: conversation, error: conversationError }, { data: membership, error: memErr }] =
    await Promise.all([
      supabase.from("conversations").select("created_by, kind").eq("id", conversationId).single(),
      supabase
        .from("conversation_members")
        .select("role")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (conversationError || !conversation || conversation.kind !== "group") {
    throw new Error("Group not found.");
  }
  if (memErr) throw memErr;
  const isOwner = conversation.created_by === user.id;
  if (!isOwner && membership?.role !== "admin") {
    throw new Error("Only the group owner or an administrator can change group settings.");
  }

  const { error } = await callGroupRpc("group_update_details", {
    p_conversation_id: conversationId,
    p_title: updates.title?.trim() ?? null,
    p_image_url: updates.image_url ?? null,
  });

  if (error) {
    console.warn("group_update_details RPC failed:", error);
    throw new Error(error.message || "Failed to update group settings.");
  }

  const { data, error: fetchError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (fetchError || !data) throw fetchError || new Error("Group updated but could not be reloaded.");
  return data;
}

export type GroupRole = "owner" | "admin" | "moderator" | "member";

/**
 * Determine effective role taking conversation creator into account.
 */
export function getEffectiveRole(
  userId: string,
  conversation: { id?: string; created_by: string },
  members: Array<{ user_id: string; role?: string | null }>,
): GroupRole {
  if (userId === conversation.created_by) return "owner";
  const m = members.find((item) => item.user_id === userId);
  if (!m) return "member";
  if (m.role === "owner") return "owner";
  if (m.role === "admin") return "admin";
  if (m.role === "moderator") return "moderator";
  return "member";
}

export function canManageGroup(role: GroupRole): boolean {
  return role === "owner" || role === "admin";
}

export function canPromoteDemote(
  actorRole: GroupRole,
  targetCurrentRole: GroupRole,
  targetNewRole: "admin" | "moderator" | "member",
): boolean {
  // Owner must not be accidentally removed or demoted
  if (targetCurrentRole === "owner") {
    return false;
  }
  // No-op if target already has that role
  if (targetCurrentRole === targetNewRole) {
    return false;
  }

  if (actorRole === "owner") {
    // Owner can promote/demote anyone (except owner) to admin, moderator, or member
    return true;
  }

  if (actorRole === "admin") {
    // Admins can:
    // - Promote ordinary members to moderator
    // - Demote moderators to members
    // Admins must NOT:
    // - Promote themselves
    // - Promote or demote other admins
    // - Promote anyone to admin
    if (targetCurrentRole === "member" && targetNewRole === "moderator") {
      return true;
    }
    if (targetCurrentRole === "moderator" && targetNewRole === "member") {
      return true;
    }
    return false;
  }

  // Moderators and ordinary members have no role management privileges
  return false;
}

export function canRemoveGroupMember(
  actorRole: GroupRole,
  targetRole: GroupRole,
  isSelf: boolean,
): boolean {
  if (isSelf) return true;
  // The owner must not be accidentally removed
  if (targetRole === "owner") return false;

  if (actorRole === "owner") {
    // Owner can remove admins, moderators, and ordinary members
    return true;
  }

  if (actorRole === "admin") {
    // Admins can remove moderators and ordinary members, but NOT other admins or the owner
    return targetRole === "moderator" || targetRole === "member";
  }

  // Moderators and ordinary members have no removal privileges
  return false;
}

/**
 * Fetch fresh members list for a group conversation.
 */
export async function getGroupMembers(
  conversationId: string,
): Promise<Array<ConversationMember & { profile?: Profile | null }>> {
  const { data: members, error: membersError } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("joined_at", { ascending: true });

  if (membersError) throw membersError;
  if (!members || members.length === 0) return [];

  const profileIds = [...new Set(members.map((m) => m.user_id))];
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", profileIds);

  const profilesMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  return members.map((m) => ({
    ...m,
    profile: profilesMap.get(m.user_id) ?? null,
  }));
}

/**
 * Add members to an existing group conversation using the PostgreSQL RPC function group_add_member.
 */
export async function addGroupMembers(conversationId: string, userIds: string[]): Promise<void> {
  const user = await getCurrentUser();

  const [convRes, memRes] = await Promise.all([
    supabase.from("conversations").select("created_by").eq("id", conversationId).single(),
    supabase
      .from("conversation_members")
      .select("user_id, role")
      .eq("conversation_id", conversationId),
  ]);

  if (convRes.error || !convRes.data) throw new Error("Conversation not found.");
  const actorRole = getEffectiveRole(user.id, convRes.data, memRes.data ?? []);

  if (!canManageGroup(actorRole)) {
    throw new Error("Only group administrators can add new members.");
  }

  // Use the PostgreSQL RPC function group_add_member(p_conversation_id, p_user_id)
  for (const userId of userIds) {
    const { error } = await callGroupRpc("group_add_member", {
      p_conversation_id: conversationId,
      p_user_id: userId,
    });

    if (error) {
      console.warn(`group_add_member RPC failed for user ${userId}:`, error);
      throw new Error(error.message || "Failed to add member to group.");
    }
  }
}

/**
 * Update a member's role in a group conversation using the PostgreSQL RPC function group_set_member_role.
 */
export async function updateGroupMemberRole(
  conversationId: string,
  targetUserId: string,
  newRole: "admin" | "moderator" | "member",
): Promise<void> {
  const user = await getCurrentUser();
  if (user.id === targetUserId) {
    throw new Error("You cannot change your own role.");
  }

  const [convRes, memRes] = await Promise.all([
    supabase.from("conversations").select("created_by").eq("id", conversationId).single(),
    supabase
      .from("conversation_members")
      .select("user_id, role")
      .eq("conversation_id", conversationId),
  ]);

  if (convRes.error || !convRes.data) throw new Error("Conversation not found.");
  const members = memRes.data ?? [];
  const actorRole = getEffectiveRole(user.id, convRes.data, members);
  const targetRole = getEffectiveRole(targetUserId, convRes.data, members);

  if (!canPromoteDemote(actorRole, targetRole, newRole)) {
    throw new Error("You do not have permission to assign this role.");
  }

  // Use the PostgreSQL RPC function group_set_member_role(p_conversation_id, p_user_id, p_new_role)
  const { error } = await callGroupRpc("group_set_member_role", {
    p_conversation_id: conversationId,
    p_user_id: targetUserId,
    p_new_role: newRole,
  });

  if (error) {
    console.warn("group_set_member_role RPC failed:", error);
    throw new Error(error.message || "Failed to update member role.");
  }
}

/**
 * Transfer group ownership to another member.
 */
export async function transferGroupOwnership(
  conversationId: string,
  newOwnerUserId: string,
): Promise<void> {
  if (!newOwnerUserId) throw new Error("Choose a valid new owner.");

  const { error } = await callGroupRpc("group_transfer_ownership", {
    p_conversation_id: conversationId,
    p_new_owner_user_id: newOwnerUserId,
  });

  if (error) {
    console.warn("group_transfer_ownership RPC failed:", error);
    throw new Error(error.message || "Failed to transfer group ownership.");
  }
}

/**
 * Remove a member from a group conversation using the PostgreSQL RPC function group_remove_member.
 */
export async function removeGroupMember(
  conversationId: string,
  memberUserId: string,
): Promise<void> {
  const user = await getCurrentUser();

  const [convRes, memRes] = await Promise.all([
    supabase.from("conversations").select("created_by").eq("id", conversationId).single(),
    supabase
      .from("conversation_members")
      .select("user_id, role")
      .eq("conversation_id", conversationId),
  ]);

  if (convRes.error || !convRes.data) throw new Error("Conversation not found.");
  const members = memRes.data ?? [];
  const actorRole = getEffectiveRole(user.id, convRes.data, members);
  const targetRole = getEffectiveRole(memberUserId, convRes.data, members);

  if (!canRemoveGroupMember(actorRole, targetRole, user.id === memberUserId)) {
    throw new Error("You do not have permission to remove this member.");
  }

  // Use the PostgreSQL RPC function group_remove_member(p_conversation_id, p_user_id)
  const { error } = await callGroupRpc("group_remove_member", {
    p_conversation_id: conversationId,
    p_user_id: memberUserId,
  });

  if (error) {
    console.warn(`group_remove_member RPC failed:`, error);
    throw new Error(error.message || "Failed to remove member from group.");
  }
}

/**
 * Leave a group conversation with automatic or designated successor if last administrator.
 */
export async function leaveGroupConversation(
  conversationId: string,
  successorUserId?: string,
): Promise<void> {
  const user = await getCurrentUser();

  const [convRes, memRes] = await Promise.all([
    supabase.from("conversations").select("*").eq("id", conversationId).single(),
    supabase.from("conversation_members").select("*").eq("conversation_id", conversationId),
  ]);

  if (convRes.error || !convRes.data) throw new Error("Group not found.");
  const conv = convRes.data;
  if (conv.kind !== "group") throw new Error("This action is only available for groups.");

  const members = memRes.data ?? [];
  const ownMembership = members.find((m) => m.user_id === user.id);
  if (!ownMembership) return;

  const userRole = getEffectiveRole(user.id, conv, members);
  const otherMembers = members.filter((m) => m.user_id !== user.id);

  // A group owner must transfer ownership before leaving while members remain.
  if (userRole === "owner" && otherMembers.length > 0) {
    const successor = successorUserId || [...otherMembers].sort(
      (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
    )[0]?.user_id;

    if (!successor || !otherMembers.some((member) => member.user_id === successor)) {
      throw new Error("Choose a valid group member to become the new owner.");
    }

    await transferGroupOwnership(conversationId, successor);
  }

  // Leaving is a self-removal. The existing RLS policy explicitly permits this.
  const { error: leaveError } = await supabase
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  if (leaveError) throw leaveError;

  // Post departure system message
  try {
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle();
    const name = myProfile?.display_name || myProfile?.username || "A member";
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: `${name} left the group.`,
      message_type: "text",
    });
  } catch {
    // Best effort announcement
  }
}

/**
 * Upload chat media to the private chat-media bucket.
 *
 * Store the stable object path in messages.media_url. A signed URL is temporary
 * and must be generated by the media renderer when a conversation is opened.
 */
export async function uploadChatMedia(
  conversationId: string,
  file: File | Blob,
  options: {
    fileName?: string | undefined;
    contentType?: string | undefined;
    onProgress?: (pct: number) => void;
  } = {},
): Promise<{ mediaUrl: string; mediaName: string }> {
  if (!conversationId?.trim()) {
    throw new Error("A conversation is required before uploading media.");
  }

  const user = await getCurrentUser();
  const suppliedName =
    options.fileName ||
    (typeof File !== "undefined" && file instanceof File ? file.name : "") ||
    `media-${Date.now()}`;

  // Never allow user-provided path separators to create nested storage paths.
  const name =
    suppliedName
      .replace(/[\/]+/g, "-")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 180) || `media-${Date.now()}`;

  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  const mimeByExtension: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    wav: "audio/wav",
    pdf: "application/pdf",
  };

  // Browsers often report recorder MIME types with codec parameters,
  // for example "audio/webm;codecs=opus" or "audio/ogg;codecs=opus".
  // Supabase's bucket allowlist and our validator expect the base MIME type.
  const contentType = (
    options.contentType ||
    file.type ||
    (extension ? mimeByExtension[extension] : "") ||
    ""
  )
    .toLowerCase()
    .split(";")[0]
    .trim();

  const allowedContentType =
    /^image\/(jpeg|png|webp|gif)$/.test(contentType) ||
    /^video\/(mp4|webm|quicktime)$/.test(contentType) ||
    /^audio\/(mpeg|mp4|ogg|wav|webm)$/.test(contentType) ||
    contentType === "application/pdf";

  if (!allowedContentType) {
    throw new Error(
      "This file type is not supported for chat attachments. Please use an image, MP4/WebM/MOV video, supported audio file, or PDF.",
    );
  }

  const maxBytes = 100 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("This attachment is larger than the 100 MB chat upload limit.");
  }

  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Storage RLS expects: {conversation_id}/{uploader_user_id}/{filename}
  const filePath = `${conversationId}/${user.id}/${Date.now()}-${randomPart}-${name}`;

  const { data, error } = await supabase.storage
    .from("chat-media")
    .upload(filePath, file, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Chat attachment upload failed: ${error.message}`);
  }

  if (!data?.path) {
    throw new Error("Chat attachment upload completed without a storage path.");
  }

  options.onProgress?.(100);

  // This is a stable storage path, not a public or expiring signed URL.
  return {
    mediaUrl: data.path,
    mediaName: name,
  };
}

/**
 * Send a message (text, image, video, audio) with optional reply_to_id.
 */
export async function sendMessage(
  conversationId: string,
  options: {
    content?: string | undefined;
    messageType?: "text" | "image" | "video" | "audio" | "file" | undefined;
    mediaUrl?: string | undefined;
    mediaName?: string | undefined;
    replyToId?: string | undefined;
  },
): Promise<Message> {
  const user = await getCurrentUser();
  const cleanContent = options.content?.trim() || null;
  const messageType = options.messageType || "text";

  if (!cleanContent && !options.mediaUrl) {
    throw new Error("Cannot send empty message without media.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: cleanContent,
      message_type: messageType,
      media_url: options.mediaUrl || null,
      media_name: options.mediaName || null,
      reply_to_id: options.replyToId || null,
    })
    .select("*")
    .single();

  if (error) throw error;

  // Touch conversation last_message_at
  void supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  return data;
}

/**
 * Send standard text message (backwards compatible).
 */
export async function sendTextMessage(
  conversationId: string,
  content: string,
  replyToId?: string,
): Promise<Message> {
  return sendMessage(conversationId, {
    content,
    messageType: "text",
    replyToId,
  });
}

/**
 * Edit an existing message (own messages only).
 */
export async function editMessage(messageId: string, newContent: string): Promise<Message> {
  const user = await getCurrentUser();
  const clean = newContent.trim();

  if (!clean) {
    throw new Error("Message content cannot be empty.");
  }

  const { data, error } = await supabase
    .from("messages")
    .update({
      content: clean,
      edited_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .eq("sender_id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Soft delete an existing message (sets deleted_at, hides content).
 */
export async function deleteMessage(messageId: string): Promise<Message> {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("messages")
    .update({
      deleted_at: new Date().toISOString(),
      content: null,
      media_url: null,
      media_name: null,
    })
    .eq("id", messageId)
    .eq("sender_id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete message for current user only (persisted in user's browser storage).
 */
export async function deleteMessageForMe(messageId: string): Promise<void> {
  const user = await getCurrentUser();
  addPerUserDeletedMessageId(user.id, messageId);
}

/**
 * Delete message for everyone in the conversation (author or group admin/owner).
 */
export async function deleteMessageForEveryone(messageId: string): Promise<Message> {
  const user = await getCurrentUser();

  const { data: msg, error: msgErr } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (msgErr || !msg) throw new Error("Message not found.");

  if (msg.sender_id === user.id) {
    // Senders retain the existing message-update path and RLS permission.
    const { data, error } = await supabase
      .from("messages")
      .update({
        deleted_at: new Date().toISOString(),
        content: null,
        media_url: null,
        media_name: null,
      })
      .eq("id", messageId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  if (!msg.conversation_id) {
    throw new Error("You do not have permission to delete this message for everyone.");
  }

  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select("created_by, kind")
    .eq("id", msg.conversation_id)
    .maybeSingle();

  if (convError) throw convError;
  if (!conv || conv.kind !== "group") {
    throw new Error("Only the message sender can delete this message.");
  }

  const { data: members, error: membersError } = await supabase
    .from("conversation_members")
    .select("user_id, role")
    .eq("conversation_id", msg.conversation_id);

  if (membersError) throw membersError;

  const role = getEffectiveRole(user.id, conv, members ?? []);
  if (!["owner", "admin", "moderator"].includes(role)) {
    throw new Error("Only group owners, admins, and moderators can moderate messages.");
  }

  const { error: moderationError } = await callGroupRpc("group_moderate_delete_message", {
    p_message_id: messageId,
  });

  if (moderationError) {
    console.warn("group_moderate_delete_message RPC failed:", moderationError);
    throw new Error(moderationError.message || "Failed to moderate this message.");
  }

  const { data, error: fetchError } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (fetchError || !data) throw fetchError || new Error("Message was deleted but could not be reloaded.");
  return data;
}

/**
 * Clear chat history for the current user.
 * Messages sent prior to clearing will no longer show for this user,
 * but remain untouched for all other conversation participants.
 */
export async function clearConversationHistory(conversationId: string): Promise<void> {
  if (!conversationId) throw new Error("Conversation ID is required.");

  await updateMyConversationSettings(conversationId, {
    cleared_at: new Date().toISOString(),
  });
}

/**
 * Delete / hide a conversation for the current user from their chat list.
 * Unhides automatically if a new message arrives.
 */
export async function hideConversationForUser(conversationId: string): Promise<void> {
  if (!conversationId) throw new Error("Conversation ID is required.");

  await updateMyConversationSettings(conversationId, {
    hidden_at: new Date().toISOString(),
  });
}

/**
 * Forward an existing message to another direct chat or group conversation.
 */
export async function forwardMessage(
  targetConversationId: string,
  message: MessageWithReadsAndReactions,
): Promise<Message> {
  return sendMessage(targetConversationId, {
    content: message.content ?? undefined,
    messageType: (message.message_type as "text" | "image" | "video" | "audio" | "file") || "text",
    mediaUrl: message.media_url ?? undefined,
    mediaName: message.media_name ?? undefined,
  });
}

/**
 * Delete a group conversation entirely (restricted strictly to group owner/creator).
 */
export async function deleteGroupConversation(conversationId: string): Promise<void> {
  const user = await getCurrentUser();
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("created_by, kind")
    .eq("id", conversationId)
    .single();

  if (convErr || !conv) throw new Error("Conversation not found.");
  if (conv.created_by !== user.id) {
    throw new Error("Only the group creator can delete this group.");
  }

  // Delete dependencies first
  try {
    const { data: msgs } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId);
    const msgIds = (msgs ?? []).map((m) => m.id);
    if (msgIds.length > 0) {
      await supabase.from("message_reads").delete().in("message_id", msgIds);
      await supabase.from("message_reactions").delete().in("message_id", msgIds);
    }
  } catch (err) {
    console.warn("Could not delete message reads/reactions:", err);
  }

  try {
    await supabase.from("messages").delete().eq("conversation_id", conversationId);
  } catch (err) {
    console.warn("Could not delete messages:", err);
  }

  try {
    await supabase.from("conversation_members").delete().eq("conversation_id", conversationId);
  } catch (err) {
    console.warn("Could not delete members:", err);
  }

  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  if (error) throw error;
}

/**
 * Toggle a reaction on a message (adds if not present, removes if already reacted).
 */
export async function toggleMessageReaction(messageId: string, emoji: string): Promise<boolean> {
  const user = await getCurrentUser();

  // Check if existing
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("*")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    // Remove
    const { error: delErr } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("emoji", emoji);

    if (delErr) throw delErr;
    return false; // Reaction removed
  } else {
    // Add
    const { error: insErr } = await supabase.from("message_reactions").insert({
      message_id: messageId,
      user_id: user.id,
      emoji,
    });

    if (insErr) throw insErr;
    return true; // Reaction added
  }
}

/**
 * Mark specified messages as read by the signed-in user and update member last_read_at.
 */
export async function markMessagesAsRead(
  conversationId: string,
  messageIds: string[],
): Promise<void> {
  if (!messageIds || messageIds.length === 0) return;

  const user = await getCurrentUser();
  const now = new Date().toISOString();

  const rows = messageIds.map((messageId) => ({
    message_id: messageId,
    user_id: user.id,
    read_at: now,
  }));

  const [readsRes, memRes] = await Promise.all([
    supabase.from("message_reads").upsert(rows, {
      onConflict: "message_id,user_id",
      ignoreDuplicates: true,
    }),
    conversationId
      ? supabase
          .from("conversation_members")
          .update({ last_read_at: now })
          .eq("conversation_id", conversationId)
          .eq("user_id", user.id)
      : Promise.resolve({ error: null }),
  ]);

  if (readsRes.error) {
    console.warn("VIDALORE MARK MESSAGES READ WARNING:", readsRes.error);
  }
  if (memRes.error) {
    console.warn("VIDALORE UPDATE LAST READ AT WARNING:", memRes.error);
  }
}

/**
 * Mark an entire conversation as read: updates last_read_at in conversation_members
 * and marks any unread messages from other senders as read.
 */
export async function markConversationAsRead(conversationId: string): Promise<string> {
  if (!conversationId) return new Date().toISOString();

  const user = await getCurrentUser();
  const now = new Date().toISOString();

  // 1. Update conversation_members last_read_at timestamp and await it
  const { error: memErr } = await supabase
    .from("conversation_members")
    .update({ last_read_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  if (memErr) {
    console.warn("Failed to update last_read_at:", memErr);
  }

  // 2. Fetch unread message IDs from others to populate message_reads
  try {
    const { data: unreadRows } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .is("deleted_at", null)
      .limit(100);

    if (unreadRows && unreadRows.length > 0) {
      const readRows = unreadRows.map((m) => ({
        message_id: m.id,
        user_id: user.id,
        read_at: now,
      }));
      await supabase.from("message_reads").upsert(readRows, {
        onConflict: "message_id,user_id",
        ignoreDuplicates: true,
      });
    }
  } catch (err) {
    console.warn("Could not upsert message_reads for conversation:", err);
  }

  return now;
}

/**
 * Subscribe to global updates for user's conversations (new messages and membership reads).
 * Keeps unread counts synchronized between tabs and accounts in real-time.
 */
export function subscribeToUserConversations(userId: string, onUpdate: () => void) {
  const channelName = `user-convs-${userId}-${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      () => {
        onUpdate();
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversation_members",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        onUpdate();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Unified Realtime Channel for a conversation:
 * Handles Postgres changes for messages, reactions, reads,
 * plus Broadcast for Typing indicators, and Presence for Online status!
 */
export function subscribeToConversationChannel(
  conversationId: string,
  currentUserId: string,
  handlers: {
    onNewMessage?: (message: Message) => void;
    onMessageUpdate?: (message: Message) => void;
    onMessageDelete?: (messageId: string) => void;
    onReactionChange?: () => void;
    onReadReceipt?: (read: MessageRead) => void;
    onTyping?: (data: { userId: string; username: string; isTyping: boolean }) => void;
    onPresenceSync?: (onlineUserIds: Set<string>) => void;
  },
) {
  const channelName = `conv-room-${conversationId}`;
  const channel = supabase.channel(channelName, {
    config: {
      presence: { key: currentUserId },
      broadcast: { ack: false },
    },
  });

  channel
    // 1. New message inserted
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.new && handlers.onNewMessage) {
          handlers.onNewMessage(payload.new as Message);
        }
      },
    )
    // 2. Message updated (edited or soft-deleted)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.new && handlers.onMessageUpdate) {
          handlers.onMessageUpdate(payload.new as Message);
        }
      },
    )
    // 3. Message hard deleted
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.old && "id" in payload.old && handlers.onMessageDelete) {
          handlers.onMessageDelete((payload.old as { id: string }).id);
        }
      },
    )
    // 4. Reactions changed
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_reactions",
      },
      () => {
        handlers.onReactionChange?.();
      },
    )
    // 5. Read receipts
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_reads",
      },
      (payload) => {
        if (payload.new && "message_id" in payload.new && handlers.onReadReceipt) {
          handlers.onReadReceipt(payload.new as MessageRead);
        }
      },
    )
    // 6. Broadcast: Typing indicator
    .on("broadcast", { event: "typing" }, (event) => {
      if (event["payload"] && handlers.onTyping) {
        handlers.onTyping(
          event["payload"] as { userId: string; username: string; isTyping: boolean },
        );
      }
    })
    // 7. Presence: Online tracking
    .on("presence", { event: "sync" }, () => {
      if (handlers.onPresenceSync) {
        const state = channel.presenceState();
        const onlineIds = new Set<string>();
        Object.keys(state).forEach((key) => onlineIds.add(key));
        handlers.onPresenceSync(onlineIds);
      }
    });

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED" && currentUserId) {
      await channel.track({
        user_id: currentUserId,
        online_at: new Date().toISOString(),
      });
    }
  });

  return {
    sendTyping: (isTyping: boolean, username: string) => {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUserId, username, isTyping },
      });
    },
    unsubscribe: () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    },
  };
}

// Backwards compatibility functions
export function subscribeToMessages(
  conversationId: string,
  onNewMessage: (message: Message) => void,
) {
  const channel = supabase
    .channel(`conversation-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onNewMessage(payload.new as Message);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToMessageReads(onNewRead: (read: MessageRead) => void) {
  const channelId = `reads-${crypto.randomUUID()}`;

  const channel = supabase
    .channel(channelId)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "message_reads",
      },
      (payload) => {
        if (payload.new && "message_id" in payload.new) {
          onNewRead(payload.new as MessageRead);
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "message_reads",
      },
      (payload) => {
        if (payload.new && "message_id" in payload.new) {
          onNewRead(payload.new as MessageRead);
        }
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Search profiles by query term.
 */
export async function searchProfiles(term: string, currentUserId: string): Promise<Profile[]> {
  const cleaned = term.trim();
  let query = supabase.from("profiles").select("*").neq("id", currentUserId).limit(20);
  if (cleaned) {
    const pattern = `%${cleaned.replace(/[%_,()]/g, "")}%`;
    query = query.or(`username.ilike.${pattern},display_name.ilike.${pattern}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Open an existing direct conversation with a member, or create one.
 */
export async function getOrCreateDirectConversation(
  otherUserId: string,
): Promise<ConversationListItem> {
  const conversation = await createDirectConversation(otherUserId);
  const conversations = await getMyConversations();
  return (
    conversations.find((item) => item.id === conversation.id) ?? {
      ...conversation,
      members: [],
      lastMessage: null,
    }
  );
}
