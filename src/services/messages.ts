import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Conversation = Tables<"conversations">;
export type ConversationMember = Tables<"conversation_members">;
export type Message = Tables<"messages">;
export type Profile = Tables<"profiles">;
export type MessageRead = Tables<"message_reads">;

export type MessageWithReads = Message & {
  reads?: MessageRead[];
};

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

  const { data: members, error: membersError } = await supabase
    .from("conversation_members")
    .select("*")
    .in("conversation_id", conversationIds);

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
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (messagesError) throw messagesError;

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

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
 * Load messages from one conversation, including their read receipts.
 */
export async function getConversationMessages(
  conversationId: string,
  limit = 100,
): Promise<MessageWithReads[]> {
  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!messages || messages.length === 0) return [];

  const messageIds = messages.map((item) => item.id);

  // Load read receipts for loaded messages
  const { data: reads, error: readsError } = await supabase
    .from("message_reads")
    .select("*")
    .in("message_id", messageIds);

  if (readsError) {
    console.warn("VIDALORE GET MESSAGE READS WARNING:", readsError);
  }

  const readsMap = new Map<string, MessageRead[]>();
  for (const read of reads ?? []) {
    const list = readsMap.get(read.message_id) ?? [];
    list.push(read);
    readsMap.set(read.message_id, list);
  }

  return messages.map((message) => ({
    ...message,
    reads: readsMap.get(message.id) ?? [],
  }));
}

/**
 * Create a direct conversation with another user.
 */
export async function createDirectConversation(otherUserId: string): Promise<Conversation> {
  const user = await getCurrentUser();

  // AUTHENTICATION DIAGNOSTIC
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  console.log("VIDALORE AUTH DIAGNOSTIC:", {
    userId: user.id,
    sessionUserId: sessionData.session?.user.id ?? null,
    hasAccessToken: Boolean(sessionData.session?.access_token),
    sameUser: user.id === sessionData.session?.user.id,
    sessionError: sessionError?.message ?? null,
  });

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

  // 1. Generate a UUID using crypto.randomUUID() before inserting.
  const conversationId = crypto.randomUUID();

  console.log("VIDALORE CONVERSATION INSERT:", {
    id: conversationId,
    createdBy: user.id,
    kind: "direct",
  });

  // 2. Insert the conversations row without chaining .select() or .single().
  const { error: conversationError } = await supabase.from("conversations").insert({
    id: conversationId,
    kind: "direct",
    created_by: user.id,
  });

  if (conversationError) {
    console.error("VIDALORE CONVERSATION INSERT ERROR:", {
      message: conversationError.message,
      code: conversationError.code,
      details: conversationError.details,
      hint: conversationError.hint,
    });

    throw conversationError;
  }

  // 3. Insert both users into conversation_members using the generated conversation ID.
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
    console.error("VIDALORE MEMBERS INSERT ERROR:", {
      message: membersError.message,
      code: membersError.code,
      details: membersError.details,
      hint: membersError.hint,
    });
    throw new Error(
      `Failed to add conversation members: ${membersError.message || membersError.details || "Database permission denied"}`,
    );
  }

  // 4. Only after the membership INSERT succeeds, fetch the conversation.
  const { data: conversation, error: fetchError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (fetchError || !conversation) {
    console.error("VIDALORE CONVERSATION FETCH ERROR:", fetchError);
    throw (
      fetchError ||
      new Error("Conversation was created, but could not be retrieved after adding members.")
    );
  }

  return conversation;
}

/**
 * Send a text message.
 */
export async function sendTextMessage(conversationId: string, content: string): Promise<Message> {
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

/**
 * Mark specified messages as read by the signed-in user.
 * Uses upsert with onConflict ("message_id,user_id") to prevent duplicates.
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

  const { error: upsertError } = await supabase.from("message_reads").upsert(rows, {
    onConflict: "message_id,user_id",
    ignoreDuplicates: true,
  });

  if (upsertError) {
    console.error("VIDALORE MARK MESSAGES READ ERROR:", upsertError);
    return;
  }

  // Update conversation_members last_read_at timestamp
  if (conversationId) {
    void supabase
      .from("conversation_members")
      .update({ last_read_at: now })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
  }
}

/**
 * Subscribe to message_reads changes in Realtime.
 */
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
