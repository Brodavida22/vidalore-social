import { useEffect, useState, useRef, useMemo, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  Plus,
  X,
  Loader2,
  ChevronDown,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  getMyConversations,
  getConversationMessages,
  sendMessage,
  uploadChatMedia,
  editMessage,
  deleteMessage,
  toggleMessageReaction,
  markMessagesAsRead,
  markConversationAsRead,
  subscribeToConversationChannel,
  subscribeToUserConversations,
  getEffectiveRole,
  type ConversationListItem,
  type MessageWithReadsAndReactions,
  type Profile,
  type Conversation,
  type GroupRole,
} from "@/services/messages";

import { ChatHeader } from "@/components/messages/ChatHeader";
import { ChatComposer } from "@/components/messages/ChatComposer";
import { MessageItem } from "@/components/messages/MessageItem";
import { NewChatModal } from "@/components/messages/NewChatModal";
import { NewGroupModal } from "@/components/messages/NewGroupModal";
import { GroupDetailsSheet } from "@/components/messages/GroupDetailsSheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function formatDateSeparator(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function MessagesPage() {
  const queryClient = useQueryClient();

  const [selectedConversation, setSelectedConversation] = useState<ConversationListItem | null>(
    null,
  );
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  // Filters & Search
  const [filterTab, setFilterTab] = useState<"all" | "direct" | "group">("all");
  const [searchText, setSearchText] = useState("");

  // Modals & Sheets
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [newGroupModalOpen, setNewGroupModalOpen] = useState(false);
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);

  // Replying & Editing
  const [replyingTo, setReplyingTo] = useState<MessageWithReadsAndReactions | null>(null);
  const [editingMessageState, setEditingMessageState] =
    useState<MessageWithReadsAndReactions | null>(null);

  // Realtime Presence & Typing
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUsersMap, setTypingUsersMap] = useState<
    Map<string, { username: string; timestamp: number }>
  >(new Map());

  // Scroll to bottom / Scroll detection
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const channelRef = useRef<{
    sendTyping: (isTyping: boolean, username: string) => void;
    unsubscribe: () => void;
  } | null>(null);

  /* Inactivity timeout cleaner for typing indicators (stops after 3.5s of no updates) */
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingUsersMap((prev) => {
        let expired = false;
        for (const [, v] of prev) {
          if (now - v.timestamp > 3500) {
            expired = true;
            break;
          }
        }
        if (!expired) return prev;
        const next = new Map();
        for (const [k, v] of prev) {
          if (now - v.timestamp <= 3500) next.set(k, v);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /* 1. LOAD AUTHENTICATED USER & PROFILE */
  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data, error }) => {
      if (!active || error || !data.user) return;
      setCurrentUserId(data.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (active && profile) {
        setCurrentProfile(profile);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  /* 2. LOAD CONVERSATIONS */
  const conversationsQuery = useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: getMyConversations,
    refetchInterval: 15000,
  });

  const rawConversations = conversationsQuery.data;
  const conversations = useMemo(() => rawConversations ?? [], [rawConversations]);
  const selectedId = selectedConversation?.id ?? "";

  // Keep selectedConversation in sync with fetched data
  useEffect(() => {
    if (selectedId && conversations.length > 0) {
      const match = conversations.find((c) => c.id === selectedId);
      if (match) setSelectedConversation(match);
    }
  }, [conversations, selectedId]);

  /* Global real-time listener for all user conversation updates (new messages, reads across devices) */
  useEffect(() => {
    if (!currentUserId) return;
    const unsub = subscribeToUserConversations(currentUserId, () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    });
    return unsub;
  }, [currentUserId, queryClient]);

  /* 3. LOAD MESSAGES FOR SELECTED CONVERSATION */
  const messagesQuery = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: () => getConversationMessages(selectedId),
    enabled: Boolean(selectedId),
  });

  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      // Tab filter
      if (filterTab === "direct" && conv.kind !== "direct") return false;
      if (filterTab === "group" && conv.kind !== "group") return false;

      // Search filter
      if (searchText.trim()) {
        const query = searchText.toLowerCase();
        if (conv.kind === "group") {
          return (conv.title || "").toLowerCase().includes(query);
        } else {
          const other = conv.members.find((m) => m.user_id !== currentUserId);
          const name = (
            other?.profile?.display_name ||
            other?.profile?.username ||
            ""
          ).toLowerCase();
          return name.includes(query);
        }
      }

      return true;
    });
  }, [conversations, filterTab, searchText, currentUserId]);

  /* 4. REALTIME CONVERSATION CHANNEL (Messages, Reads, Reactions, Typing, Presence) */
  useEffect(() => {
    if (!selectedId || !currentUserId) return;

    setTypingUsersMap(new Map());

    const channel = subscribeToConversationChannel(selectedId, currentUserId, {
      onNewMessage: (newMessage) => {
        // Clear typing indicator for sender
        setTypingUsersMap((prev) => {
          if (!prev.has(newMessage.sender_id)) return prev;
          const next = new Map(prev);
          next.delete(newMessage.sender_id);
          return next;
        });

        queryClient.setQueryData<MessageWithReadsAndReactions[]>(
          ["messages", selectedId],
          (old = []) => {
            if (old.some((m) => m.id === newMessage.id)) return old;
            return [
              ...old,
              {
                ...newMessage,
                reads: [],
                reactions: [],
              },
            ];
          },
        );

        // If viewing this chat and message is from another, mark read immediately
        if (newMessage.sender_id !== currentUserId) {
          void markConversationAsRead(selectedId);
        }

        // Optimistically update conversation list
        queryClient.setQueryData<ConversationListItem[]>(
          ["messages", "conversations"],
          (old = []) =>
            old.map((c) => {
              if (c.id === selectedId) {
                return {
                  ...c,
                  lastMessage: newMessage,
                  last_message_at: newMessage.created_at,
                  unreadCount: 0,
                };
              }
              return c;
            }),
        );

        scrollToBottom();
      },

      onMessageUpdate: (updatedMessage) => {
        queryClient.setQueryData<MessageWithReadsAndReactions[]>(
          ["messages", selectedId],
          (old = []) =>
            old.map((m) => (m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m)),
        );
        queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
      },

      onMessageDelete: (deletedMessageId) => {
        queryClient.setQueryData<MessageWithReadsAndReactions[]>(
          ["messages", selectedId],
          (old = []) => old.filter((m) => m.id !== deletedMessageId),
        );
        queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
      },

      onReactionChange: () => {
        queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
      },

      onReadReceipt: (newRead) => {
        queryClient.setQueryData<MessageWithReadsAndReactions[]>(
          ["messages", selectedId],
          (old = []) =>
            old.map((msg) => {
              if (msg.id === newRead.message_id) {
                const existing = msg.reads ?? [];
                if (existing.some((r) => r.user_id === newRead.user_id)) return msg;
                return { ...msg, reads: [...existing, newRead] };
              }
              return msg;
            }),
        );
      },

      onTyping: ({ userId, username, isTyping }) => {
        if (userId === currentUserId) return;
        setTypingUsersMap((prev) => {
          const next = new Map(prev);
          if (isTyping) {
            next.set(userId, { username, timestamp: Date.now() });
          } else {
            next.delete(userId);
          }
          return next;
        });
      },

      onPresenceSync: (onlineIds) => {
        setOnlineUserIds(onlineIds);
      },
    });

    channelRef.current = channel;

    return () => {
      // Clear typing broadcast before unhooking channel
      if (currentProfile) {
        channel.sendTyping(false, currentProfile.display_name || currentProfile.username);
      }
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [selectedId, currentUserId, currentProfile, queryClient]);

  /* 5. AUTO-MARK CONVERSATION AS READ WHEN DISPLAYED */
  useEffect(() => {
    if (!selectedId || !currentUserId) return;

    // Immediately clear unread badge in conversation list cache
    queryClient.setQueryData<ConversationListItem[]>(["messages", "conversations"], (old = []) =>
      old.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              unreadCount: 0,
              members: c.members.map((m) =>
                m.user_id === currentUserId ? { ...m, last_read_at: new Date().toISOString() } : m,
              ),
            }
          : c,
      ),
    );

    // Persist read state in database
    void markConversationAsRead(selectedId);
  }, [selectedId, currentUserId, messages.length, queryClient]);

  /* 6. SCROLL TO BOTTOM LOGIC */
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, [selectedId, messages.length]);

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 180;
    setShowScrollBottomBtn(isUp);
  };

  // Smooth scroll and flash message when quoted reply is clicked
  const handleLocateMessage = (targetMessageId: string) => {
    const el = document.getElementById(`msg-${targetMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-[#E91E63]/20");
      setTimeout(() => {
        el.classList.remove("bg-[#E91E63]/20");
      }, 1500);
    } else {
      toast.info("Message is further up in history.");
    }
  };

  /* 7. SEND MESSAGE MUTATION (Text, Media, Reply, Edit) */
  const sendMutation = useMutation({
    mutationFn: async (payload: {
      content?: string | undefined;
      mediaFile?: File | Blob;
      messageType?: "text" | "image" | "video" | "audio" | "file" | undefined;
      replyToId?: string | undefined;
    }) => {
      if (!selectedId) throw new Error("No conversation selected.");

      // If in edit mode:
      if (editingMessageState) {
        if (!payload.content?.trim()) throw new Error("Edited message cannot be empty.");
        return await editMessage(editingMessageState.id, payload.content);
      }

      let mediaUrl: string | undefined;
      let mediaName: string | undefined;

      // Handle media upload
      if (payload.mediaFile) {
        const uploadResult = await uploadChatMedia(selectedId, payload.mediaFile, {
          fileName: payload.mediaFile instanceof File ? payload.mediaFile.name : undefined,
        });
        mediaUrl = uploadResult.mediaUrl;
        mediaName = uploadResult.mediaName;
      }

      return await sendMessage(selectedId, {
        content: payload.content,
        messageType: payload.messageType || "text",
        mediaUrl,
        mediaName,
        replyToId: payload.replyToId,
      });
    },

    onSuccess: () => {
      handleBroadcastTyping(false);
      setReplyingTo(null);
      setEditingMessageState(null);
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
      setTimeout(() => scrollToBottom(), 100);
    },

    onError: (err) => {
      console.error("SEND MESSAGE ERROR:", err);
      toast.error(err instanceof Error ? err.message : "Failed to send message.");
    },
  });

  /* 8. MESSAGE ACTIONS: Reaction, Edit, Delete */
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleMessageReaction(messageId, emoji);
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to react.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
      await deleteMessage(messageId);
      toast.success("Message deleted.");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete message.");
    }
  };

  const handleBroadcastTyping = (isTyping: boolean) => {
    if (channelRef.current && currentProfile) {
      channelRef.current.sendTyping(
        isTyping,
        currentProfile.display_name || currentProfile.username,
      );
    }
  };

  // Grouped messages by date
  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; items: MessageWithReadsAndReactions[] }> = [];

    messages.forEach((msg) => {
      const dateLabel = formatDateSeparator(msg.created_at);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === dateLabel) {
        lastGroup.items.push(msg);
      } else {
        groups.push({ date: dateLabel, items: [msg] });
      }
    });

    return groups;
  }, [messages]);

  // Is direct conversation peer online?
  const isDirectPeerOnline = useMemo(() => {
    if (!selectedConversation || selectedConversation.kind === "group") return false;
    const other = selectedConversation.members.find((m) => m.user_id !== currentUserId);
    return Boolean(other && onlineUserIds.has(other.user_id));
  }, [selectedConversation, currentUserId, onlineUserIds]);

  const currentMemberRole: GroupRole = useMemo(() => {
    if (!selectedConversation) return "member";
    return getEffectiveRole(currentUserId, selectedConversation, selectedConversation.members);
  }, [selectedConversation, currentUserId]);

  const isCurrentGroupAdmin = currentMemberRole === "owner" || currentMemberRole === "admin";

  const activeTypingNames = useMemo(() => {
    return Array.from(typingUsersMap.values()).map((v) => v.username);
  }, [typingUsersMap]);

  const handleSelectConversation = (conv: ConversationListItem) => {
    if (channelRef.current && currentProfile) {
      channelRef.current.sendTyping(false, currentProfile.display_name || currentProfile.username);
    }
    setSelectedConversation(conv);
    queryClient.setQueryData<ConversationListItem[]>(["messages", "conversations"], (old = []) =>
      old.map((c) =>
        c.id === conv.id
          ? {
              ...c,
              unreadCount: 0,
              members: c.members.map((m) =>
                m.user_id === currentUserId ? { ...m, last_read_at: new Date().toISOString() } : m,
              ),
            }
          : c,
      ),
    );
    void markConversationAsRead(conv.id);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-90px)] max-w-7xl flex-col p-2 sm:p-4 md:h-[calc(100dvh-40px)] md:p-6">
      {/* TOP BAR / HEADER */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#E91E63]/10 p-2.5 text-[#E91E63]">
            <MessageCircle size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display text-foreground">Messages</h1>
            <p className="text-xs text-muted-foreground">
              Real-time direct chats, groups, media & voice notes.
            </p>
          </div>
        </div>

        {/* Action buttons: New Chat & New Group */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNewGroupModalOpen(true)}
            className="h-8 text-xs rounded-xl gap-1.5 border-border hover:bg-secondary"
          >
            <Users size={14} className="text-[#E91E63]" />
            <span className="hidden sm:inline">New Group</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setNewChatModalOpen(true)}
            className="h-8 text-xs rounded-xl gap-1.5 bg-[#E91E63] hover:bg-[#C2185B] text-white font-semibold shadow-sm"
          >
            <Plus size={15} />
            <span>New Chat</span>
          </Button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[340px_1fr] shadow-sm">
        {/* ================= LEFT SIDEBAR ================= */}
        <aside
          className={`${
            selectedConversation ? "hidden md:flex" : "flex"
          } min-h-0 flex-col border-r border-border bg-card`}
        >
          {/* Search & Tabs */}
          <div className="border-b border-border p-3 space-y-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search chats..."
                className="w-full rounded-xl border border-border bg-secondary/60 py-2 pl-9 pr-8 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-[#E91E63]"
                maxLength={50}
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1 text-[11px] font-semibold text-center select-none">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`py-1 rounded-lg transition ${
                  filterTab === "all"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("direct")}
                className={`py-1 rounded-lg transition ${
                  filterTab === "direct"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Direct
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("group")}
                className={`py-1 rounded-lg transition ${
                  filterTab === "group"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Groups
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-border/40">
            {conversationsQuery.isLoading && (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 size={18} className="animate-spin text-[#E91E63]" />
                <p className="text-xs">Loading conversations...</p>
              </div>
            )}

            {!conversationsQuery.isLoading && filteredConversations.length === 0 && (
              <div className="px-6 py-12 text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E91E63]/10 text-[#E91E63]">
                  <MessageCircle size={22} />
                </div>
                <h3 className="text-xs font-semibold text-foreground">
                  {searchText.trim() ? "No matching conversations" : "No conversations yet"}
                </h3>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  {searchText.trim()
                    ? "Try searching with a different name or start a new chat."
                    : "Connect with friends or start a group to begin messaging."}
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNewChatModalOpen(true)}
                    className="text-xs h-7 rounded-lg"
                  >
                    Start Chat
                  </Button>
                </div>
              </div>
            )}

            {filteredConversations.map((conv) => {
              const isGroup = conv.kind === "group";
              const otherMember = conv.members.find((m) => m.user_id !== currentUserId);
              const title = isGroup
                ? conv.title || "Group"
                : otherMember?.profile?.display_name || otherMember?.profile?.username || "User";
              const avatar = isGroup ? conv.image_url : otherMember?.profile?.avatar_url;
              const active = selectedConversation?.id === conv.id;
              const isPeerOnline =
                !isGroup && Boolean(otherMember && onlineUserIds.has(otherMember.user_id));

              // Format last message preview
              let lastMsgSnippet = "Start a conversation";
              if (conv.lastMessage) {
                if (conv.lastMessage.deleted_at) {
                  lastMsgSnippet = "Message deleted";
                } else if (conv.lastMessage.message_type === "image") {
                  lastMsgSnippet = "📷 Photo";
                } else if (conv.lastMessage.message_type === "video") {
                  lastMsgSnippet = "🎥 Video";
                } else if (conv.lastMessage.message_type === "audio") {
                  lastMsgSnippet = "🎤 Voice note";
                } else {
                  lastMsgSnippet = conv.lastMessage.content || "Message";
                }
              }

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => handleSelectConversation(conv)}
                  className={`flex w-full items-center gap-3 p-3.5 text-left transition select-none ${
                    active ? "bg-[#E91E63]/10" : "hover:bg-secondary/60"
                  }`}
                >
                  {/* Avatar with status indicator */}
                  <div className="relative shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        className="h-11 w-11 rounded-full object-cover ring-1 ring-border"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground ring-1 ring-border">
                        {isGroup ? (
                          <Users size={18} className="text-[#E91E63]" />
                        ) : (
                          <MessageCircle size={18} />
                        )}
                      </div>
                    )}

                    {isPeerOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#22C55E] ring-2 ring-card" />
                    )}
                  </div>

                  {/* Text details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-xs font-semibold text-foreground">{title}</p>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDateSeparator(conv.last_message_at)}
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] text-muted-foreground">{lastMsgSnippet}</p>
                      {Boolean(conv.unreadCount && conv.unreadCount > 0) && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E91E63] px-1 text-[10px] font-bold text-white shadow-xs">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ================= RIGHT CHAT WINDOW ================= */}
        <section
          className={`${
            selectedConversation ? "flex" : "hidden md:flex"
          } min-h-0 flex-col bg-background/50 relative`}
        >
          {!selectedConversation ? (
            /* Empty State */
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E91E63]/10 text-[#E91E63]">
                <MessageCircle size={32} />
              </div>
              <h2 className="text-base font-bold font-display text-foreground">
                VIDALORE Messaging
              </h2>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Select an existing conversation or start a new direct or group chat.
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setNewChatModalOpen(true)}
                  className="rounded-xl bg-[#E91E63] text-white hover:bg-[#C2185B] text-xs h-8"
                >
                  New Chat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNewGroupModalOpen(true)}
                  className="rounded-xl text-xs h-8"
                >
                  Create Group
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* CHAT HEADER */}
              <ChatHeader
                conversation={selectedConversation}
                currentUserId={currentUserId}
                isOnline={isDirectPeerOnline}
                typingUsers={activeTypingNames}
                onBack={() => setSelectedConversation(null)}
                onOpenDetails={() => setGroupDetailsOpen(true)}
              />

              {/* MESSAGES SCROLL CONTAINER */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4"
              >
                {messagesQuery.isLoading && (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 size={20} className="animate-spin text-[#E91E63]" />
                    <p className="text-xs">Loading message history...</p>
                  </div>
                )}

                {!messagesQuery.isLoading && messages.length === 0 && (
                  <div className="py-16 text-center space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E91E63]/10 text-[#E91E63]">
                      <Sparkles size={22} />
                    </div>
                    <p className="text-xs font-semibold text-foreground">
                      No messages yet in this conversation
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Say hello, share a photo, or send a voice note! 🌹
                    </p>
                  </div>
                )}

                {/* Render Grouped Messages by Date */}
                {groupedMessages.map((group) => (
                  <div key={group.date} className="space-y-3">
                    {/* Date Separator Pill */}
                    <div className="flex items-center justify-center my-3 select-none">
                      <span className="rounded-full bg-secondary/80 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border border-border">
                        {group.date}
                      </span>
                    </div>

                    {group.items.map((msg) => (
                      <MessageItem
                        key={msg.id}
                        message={msg}
                        currentUserId={currentUserId}
                        isGroup={selectedConversation.kind === "group"}
                        isAdmin={isCurrentGroupAdmin}
                        onReply={(m) => {
                          setEditingMessageState(null);
                          setReplyingTo(m);
                        }}
                        onEdit={(m) => {
                          setReplyingTo(null);
                          setEditingMessageState(m);
                        }}
                        onDelete={handleDeleteMessage}
                        onToggleReaction={handleToggleReaction}
                        onLocateMessage={handleLocateMessage}
                      />
                    ))}
                  </div>
                ))}

                {/* Typing Indicator in message stream */}
                {activeTypingNames.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground ml-2 animate-pulse">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#E91E63]"></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#E91E63]"></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#E91E63]"></span>
                    </div>
                    <span className="text-[11px] font-medium">
                      {activeTypingNames.length === 1
                        ? `${activeTypingNames[0]} is typing...`
                        : activeTypingNames.length === 2
                          ? `${activeTypingNames[0]} and ${activeTypingNames[1]} are typing...`
                          : `${activeTypingNames[0]}, ${activeTypingNames[1]} and ${activeTypingNames.length - 2} others are typing...`}
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* FLOATING JUMP TO BOTTOM BUTTON */}
              {showScrollBottomBtn && (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  className="absolute bottom-20 right-6 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#E91E63] text-white shadow-lg hover:bg-[#C2185B] transition"
                  title="Jump to latest"
                >
                  <ChevronDown size={18} />
                </button>
              )}

              {/* CHAT COMPOSER */}
              <ChatComposer
                onSendMessage={async (data) => {
                  await sendMutation.mutateAsync(data);
                }}
                onTyping={handleBroadcastTyping}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                editingMessage={editingMessageState}
                onCancelEdit={() => setEditingMessageState(null)}
                isSending={sendMutation.isPending}
              />

              {/* GROUP DETAILS SHEET */}
              {selectedConversation.kind === "group" && (
                <GroupDetailsSheet
                  open={groupDetailsOpen}
                  onOpenChange={setGroupDetailsOpen}
                  conversation={selectedConversation}
                  currentUserId={currentUserId}
                  onConversationUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
                  }}
                  onLeftGroup={() => {
                    setSelectedConversation(null);
                    queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
                  }}
                />
              )}
            </>
          )}
        </section>
      </div>

      {/* NEW CHAT MODAL */}
      <NewChatModal
        open={newChatModalOpen}
        onOpenChange={setNewChatModalOpen}
        currentUserId={currentUserId}
        onConversationSelected={(conv) => {
          setSelectedConversation(conv);
          queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
        }}
      />

      {/* NEW GROUP MODAL */}
      <NewGroupModal
        open={newGroupModalOpen}
        onOpenChange={setNewGroupModalOpen}
        currentUserId={currentUserId}
        onGroupCreated={(group) => {
          queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
          // Open group directly
          const fullConv: ConversationListItem = {
            ...group,
            members: [],
            lastMessage: null,
          };
          setSelectedConversation(fullConv);
        }}
      />
    </div>
  );
}
