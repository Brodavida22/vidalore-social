import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Conversation = Tables<"conversations">;
export type ConversationMember = Tables<"conversation_members">;
export type Message = Tables<"messages">;
export type Profile = Tables<"profiles">;

export type ConversationListItem = Conversation & {
  members: Array<
    ConversationMember & {
      profile: Profile | null;
    }
  >;
  lastMessage: Message | null;
};

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("You must be logged in.");

  return data.user;
}

/**
 * Load all conversations belonging to the signed-in user.
 */
export async function getMyConversations(): Promise<ConversationListItem[]> {
  const user = await getCurrentUser();

  const { data: memberships, error: membershipError } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("user_id", user.id);

  if (membershipError) throw membershipError;

  const conversationIds = [
    ...new Set((memberships ?? []).map((item) => item.conversation_id)),
  ];

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

  const { data: members, error: membersError } = await supabase
    .from("conversation_members")
    .select("*")
    .in("conversation_id", conversationIds);

  if (membersError) throw membersError;

  const profileIds = [
    ...new Set((members ?? []).map((member) => member.user_id)),
  ];

  let profiles: Profile[] = [];

  if (profileIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", profileIds);

    if (error) throw error;
    profiles = data ?? [];
  }

  const { data: recentMessages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (messagesError) throw messagesError;

  const profileMap = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  const lastMessageMap = new Map<string, Message>();

  for (const message of recentMessages ?? []) {
    if (!lastMessageMap.has(message.conversation_id)) {
      lastMessageMap.set(message.conversation_id, message);
    }
  }

  return (conversations ?? []).map((conversation) => ({
    ...conversation,
    members: (members ?? [])
      .filter((member) => member.conversation_id === conversation.id)
      .map((member) => ({
        ...member,
        profile: profileMap.get(member.user_id) ?? null,
      })),
    lastMessage: lastMessageMap.get(conversation.id) ?? null,
  }));
}

/**
 * Load messages from one conversation.
 */
export async function getConversationMessages(
  conversationId: string,
  limit = 100
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return data ?? [];
}

/**
 * Create a direct conversation with another user.
 */
export async function createDirectConversation(
  otherUserId: string
): Promise<Conversation> {
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

    const sharedIds = [
      ...new Set((sharedMemberships ?? []).map((item) => item.conversation_id)),
    ];

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

  // Create a new conversation.
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({
      kind: "direct",
      created_by: user.id,
    })
    .select("*")
    .single();

  if (conversationError) throw conversationError;

  // Add both participants.
  const { error: membersError } = await supabase
    .from("conversation_members")
    .insert([
      {
        conversation_id: conversation.id,
        user_id: user.id,
        role: "member",
      },
      {
        conversation_id: conversation.id,
        user_id: otherUserId,
        role: "member",
      },
    ]);

  if (membersError) throw membersError;

  return conversation;
}

/**
 * Send a text message.
 */
export async function sendTextMessage(
  conversationId: string,
  content: string
): Promise<Message> {
  const user = await getCurrentUser();
  const cleanContent = content.trim();

  if (!cleanContent) {
    throw new Error("Message cannot be empty.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: cleanContent,
      message_type: "text",
    })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * Subscribe to new messages in a conversation.
 */
export function subscribeToMessages(
  conversationId: string,
  onNewMessage: (message: Message) => void
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
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
