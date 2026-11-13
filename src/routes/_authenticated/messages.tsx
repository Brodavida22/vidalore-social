import { useEffect, useState, useRef, useMemo, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Eraser,
  Trash2,
  MoreVertical,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  getMyConversations,
  getConversationMessages,
  sendMessage,
  uploadChatMedia,
  editMessage,
  deleteMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  clearConversationHistory,
  hideConversationForUser,
  forwardMessage,
  deleteGroupConversation,
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

import {
  useOnlinePresence,
  seedProfileLastSeen,
  extractProfileLastSeen,
  getEffectiveLastSeen,
} from "@/lib/onlinePresence";
import { formatMessageTextForPreview } from "@/lib/storyReplyPayload";
import { PresenceDot, PresenceStatusText } from "@/components/social/PresenceIndicator";
import { ChatHeader } from "@/components/messages/ChatHeader";
import { ChatComposer } from "@/components/messages/ChatComposer";
import { MessageItem } from "@/components/messages/MessageItem";
import { NewChatModal } from "@/components/messages/NewChatModal";
import { NewGroupModal } from "@/components/messages/NewGroupModal";
import { GroupDetailsSheet } from "@/components/messages/GroupDetailsSheet";
import { DeleteMessageDialog } from "@/components/messages/DeleteMessageDialog";
import { ForwardMessageModal } from "@/components/messages/ForwardMessageModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

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

function useVisualViewportHeight() {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    handleResize();

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      window.visualViewport.addEventListener("scroll", handleResize);
    } else {
      window.addEventListener("resize", handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
        window.visualViewport.removeEventListener("scroll", handleResize);
      } else {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, []);

  return viewportHeight;
}

function MessagesPage() {
  const queryClient = useQueryClient();
  const viewportHeight = useVisualViewportHeight();

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

  // WhatsApp-Style Message Actions: Forward & Delete Modals
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<MessageWithReadsAndReactions | null>(
    null,
  );

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<MessageWithReadsAndReactions | null>(null);

  // Sidebar Chat Management Modals
  const [sidebarTargetConv, setSidebarTargetConv] = useState<ConversationListItem | null>(null);
  const [sidebarClearChatOpen, setSidebarClearChatOpen] = useState(false);
  const [sidebarDeleteConvOpen, setSidebarDeleteConvOpen] = useState(false);

  // Replying & Editing
  const [replyingTo, setReplyingTo] = useState<MessageWithReadsAndReactions | null>(null);
  const [editingMessageState, setEditingMessageState] =
    useState<MessageWithReadsAndReactions | null>(null);

  // Realtime Presence & Typing
  const { isOnline, nowMs } = useOnlinePresence();
  const [typingUsersMap, setTypingUsersMap] = useState<
    Map<string, { username: string; timestamp: number }>
  >(new Map());

  // Optimistic / Failed message delivery state per conversation
  type SendPayload = {
    content?: string | undefined;
    mediaFile?: File | Blob;
    messageType?: "text" | "image" | "video" | "audio" | "file" | undefined;
    replyToId?: string | undefined;
  };
  const [optimisticMessagesByConv, setOptimisticMessagesByConv] = useState<
    Record<string, MessageWithReadsAndReactions[]>
  >({});
  const retryPayloadsRef = useRef<Map<string, SendPayload>>(new Map());
  const [isEditingPending, setIsEditingPending] = useState(false);

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

  // Keep selectedConversation in sync with fetched data and seed last_seen_at values
  useEffect(() => {
    if (conversations.length > 0) {
      seedProfileLastSeen(conversations.flatMap((c) => c.members.map((m) => m.profile)));
    }
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
  const displayMessages = useMemo(() => {
    const pendingForConv = optimisticMessagesByConv[selectedId] ?? [];
    if (pendingForConv.length === 0) return messages;
    const confirmedIds = new Set(messages.map((m) => m.id));
    const remainingPending = pendingForConv.filter((m) => !confirmedIds.has(m.id));
    return [...messages, ...remainingPending];
  }, [messages, optimisticMessagesByConv, selectedId]);

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

      onPeerLeave: (leftUserId) => {
        setTypingUsersMap((prev) => {
          if (!prev.has(leftUserId)) return prev;
          const next = new Map(prev);
          next.delete(leftUserId);
          return next;
        });
      },

      onMemberReadUpdate: ({ userId, lastReadAt }) => {
        queryClient.setQueryData<ConversationListItem[]>(
          ["messages", "conversations"],
          (old = []) =>
            old.map((c) =>
              c.id === selectedId
                ? {
                    ...c,
                    members: c.members.map((m) =>
                      m.user_id === userId ? { ...m, last_read_at: lastReadAt } : m,
                    ),
                  }
                : c,
            ),
        );
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

  /* 6. INTELLIGENT SCROLL TO BOTTOM LOGIC */
  const isNearBottomRef = useRef(true);
  const prevMessagesCountRef = useRef(0);
  const prevSelectedIdRef = useRef<string | null>(null);

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  };

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceToBottom < 100;
    isNearBottomRef.current = isNearBottom;
    setShowScrollBottomBtn(!isNearBottom);
  };

  useEffect(() => {
    if (!selectedId) return;

    // Reset scroll when opening a different conversation
    if (prevSelectedIdRef.current !== selectedId) {
      prevSelectedIdRef.current = selectedId;
      prevMessagesCountRef.current = displayMessages.length;
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
      return;
    }

    // When message count changes in current conversation
    if (displayMessages.length > prevMessagesCountRef.current) {
      const lastMsg = displayMessages[displayMessages.length - 1];
      const isMine = lastMsg?.sender_id === currentUserId;

      // Only auto-scroll if message was sent by me OR user was already at the bottom reading
      if (isMine || isNearBottomRef.current) {
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
      }
      prevMessagesCountRef.current = displayMessages.length;
    }
  }, [selectedId, displayMessages, currentUserId]);

  // Keep latest message visible if user was reading at the bottom when mobile keyboard opens
  useEffect(() => {
    if (viewportHeight && isNearBottomRef.current && selectedConversation) {
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [viewportHeight, selectedConversation]);

  // Active chat notification for mobile shell
  useEffect(() => {
    const isActive = Boolean(selectedConversation);
    if (isActive) {
      document.body.setAttribute("data-active-chat", "true");
    } else {
      document.body.removeAttribute("data-active-chat");
    }

    window.dispatchEvent(
      new CustomEvent("vidalore:active-chat-changed", {
        detail: { active: isActive },
      }),
    );

    return () => {
      document.body.removeAttribute("data-active-chat");
      window.dispatchEvent(
        new CustomEvent("vidalore:active-chat-changed", {
          detail: { active: false },
        }),
      );
    };
  }, [selectedConversation]);

  // Lock page-level body scroll on mobile during active conversation to avoid layout jumping
  useEffect(() => {
    if (!selectedConversation) return;

    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;

    if (window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
    };
  }, [selectedConversation]);

  // Handle Android / browser back button to return to chat list if active chat is open
  useEffect(() => {
    if (!selectedConversation) return;

    window.history.pushState({ vidaloreChat: selectedConversation.id }, "");

    const handlePopState = () => {
      setSelectedConversation(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [selectedConversation]);

  const handleBackFromChat = () => {
    if (typeof window !== "undefined" && window.history.state?.vidaloreChat) {
      window.history.back();
    } else {
      setSelectedConversation(null);
    }
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

  /* 7. SEND MESSAGE (Optimistic Sending/Sent/Failed + Edit mode) */
  const deliverOptimisticMessage = async (
    targetConvId: string,
    tempId: string,
    payload: SendPayload,
  ) => {
    try {
      let mediaUrl: string | undefined;
      let mediaName: string | undefined;

      if (payload.mediaFile) {
        const uploadResult = await uploadChatMedia(targetConvId, payload.mediaFile, {
          fileName: payload.mediaFile instanceof File ? payload.mediaFile.name : undefined,
        });
        mediaUrl = uploadResult.mediaUrl;
        mediaName = uploadResult.mediaName;
      }

      const sentMsg = await sendMessage(targetConvId, {
        content: payload.content,
        messageType: payload.messageType || "text",
        mediaUrl,
        mediaName,
        replyToId: payload.replyToId,
      });

      retryPayloadsRef.current.delete(tempId);
      setOptimisticMessagesByConv((prev) => {
        const currentList = prev[targetConvId];
        if (!currentList) return prev;
        return {
          ...prev,
          [targetConvId]: currentList.filter((m) => m.id !== tempId),
        };
      });

      queryClient.setQueryData<MessageWithReadsAndReactions[]>(
        ["messages", targetConvId],
        (old = []) => {
          if (old.some((m) => m.id === sentMsg.id)) return old;
          return [
            ...old,
            {
              ...sentMsg,
              sender: currentProfile ?? null,
              reads: [],
              reactions: [],
              localStatus: "sent",
            },
          ];
        },
      );

      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
      setTimeout(() => scrollToBottom(), 80);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send message.";
      console.error("SEND MESSAGE ERROR:", err);
      setOptimisticMessagesByConv((prev) => {
        const currentList = prev[targetConvId] ?? [];
        return {
          ...prev,
          [targetConvId]: currentList.map((m) =>
            m.id === tempId ? { ...m, localStatus: "failed", localError: errorMsg } : m,
          ),
        };
      });
      toast.error(errorMsg);
    }
  };

  const handleSendMessage = async (payload: SendPayload) => {
    if (!selectedId) throw new Error("No conversation selected.");

    if (editingMessageState) {
      if (!payload.content?.trim()) throw new Error("Edited message cannot be empty.");
      setIsEditingPending(true);
      try {
        await editMessage(editingMessageState.id, payload.content);
        handleBroadcastTyping(false);
        setEditingMessageState(null);
        queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
        queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to edit message.");
        throw err;
      } finally {
        setIsEditingPending(false);
      }
      return;
    }

    const tempId = `temp-${crypto.randomUUID()}`;
    const targetConvId = selectedId;
    const activeReply = replyingTo;

    const optimisticMsg: MessageWithReadsAndReactions = {
      id: tempId,
      conversation_id: targetConvId,
      sender_id: currentUserId,
      content:
        payload.content?.trim() ||
        (payload.mediaFile
          ? `[Sending ${payload.messageType === "audio" ? "voice note" : payload.messageType || "attachment"}...]`
          : null),
      message_type: payload.messageType || "text",
      media_url: null,
      media_name: payload.mediaFile instanceof File ? payload.mediaFile.name : null,
      reply_to_id: payload.replyToId || null,
      replyToMessage: activeReply
        ? {
            id: activeReply.id,
            conversation_id: activeReply.conversation_id,
            content: activeReply.content,
            message_type: activeReply.message_type,
            sender_id: activeReply.sender_id,
            media_url: activeReply.media_url,
            media_name: activeReply.media_name,
            reply_to_id: activeReply.reply_to_id,
            edited_at: activeReply.edited_at,
            deleted_at: activeReply.deleted_at,
            created_at: activeReply.created_at,
          }
        : null,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      sender: currentProfile ?? null,
      reads: [],
      reactions: [],
      localStatus: "sending",
    };

    retryPayloadsRef.current.set(tempId, payload);
    setOptimisticMessagesByConv((prev) => ({
      ...prev,
      [targetConvId]: [...(prev[targetConvId] ?? []), optimisticMsg],
    }));

    handleBroadcastTyping(false);
    setReplyingTo(null);
    requestAnimationFrame(() => scrollToBottom(true));

    void deliverOptimisticMessage(targetConvId, tempId, payload);
  };

  const handleRetryFailedMessage = (failedMsg: MessageWithReadsAndReactions) => {
    const payload = retryPayloadsRef.current.get(failedMsg.id);
    if (!payload) {
      toast.error("Original message payload is no longer available.");
      return;
    }
    const targetConvId = failedMsg.conversation_id;
    setOptimisticMessagesByConv((prev) => ({
      ...prev,
      [targetConvId]: (prev[targetConvId] ?? []).map((m) =>
        m.id === failedMsg.id ? { ...m, localStatus: "sending", localError: undefined } : m,
      ),
    }));
    void deliverOptimisticMessage(targetConvId, failedMsg.id, payload);
  };

  const handleDismissFailedMessage = (messageId: string) => {
    retryPayloadsRef.current.delete(messageId);
    if (!selectedId) return;
    setOptimisticMessagesByConv((prev) => ({
      ...prev,
      [selectedId]: (prev[selectedId] ?? []).filter((m) => m.id !== messageId),
    }));
  };

  /* 8. MESSAGE ACTIONS: Reaction, Delete For Me/Everyone, Forward, Clear Chat */
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleMessageReaction(messageId, emoji);
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to react.");
    }
  };

  const handleDeleteForMe = async (messageId: string) => {
    try {
      await deleteMessageForMe(messageId);
      toast.success("Message deleted for you.");
      queryClient.setQueryData<MessageWithReadsAndReactions[]>(
        ["messages", selectedId],
        (old = []) => old.filter((m) => m.id !== messageId),
      );
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete message.");
    }
  };

  const handleDeleteForEveryone = async (messageId: string) => {
    try {
      await deleteMessageForEveryone(messageId);
      toast.success("Message deleted for everyone.");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete message for everyone.");
    }
  };

  const handleClearChat = async (targetConvId?: string) => {
    const convId = targetConvId || selectedId;
    if (!convId) return;
    try {
      await clearConversationHistory(convId);
      toast.success("Chat history cleared.");
      if (convId === selectedId) {
        queryClient.setQueryData<MessageWithReadsAndReactions[]>(["messages", selectedId], []);
      }
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear chat history.");
    }
  };

  const handleDeleteConversation = async (targetConvId?: string) => {
    const convId = targetConvId || selectedId;
    if (!convId) return;
    try {
      await hideConversationForUser(convId);
      toast.success("Conversation deleted.");
      if (convId === selectedId) {
        setSelectedConversation(null);
      }
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete conversation.");
    }
  };

  const handleDeleteGroup = async (targetConvId?: string) => {
    const convId = targetConvId || selectedId;
    if (!convId) return;
    try {
      await deleteGroupConversation(convId);
      toast.success("Group deleted for everyone.");
      if (convId === selectedId) {
        setSelectedConversation(null);
      }
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete group.");
    }
  };

  const handleForwardMessage = async (targetConversationId: string) => {
    if (!forwardingMessage) return;
    try {
      await forwardMessage(targetConversationId, forwardingMessage);
      toast.success("Message forwarded!");
      queryClient.invalidateQueries({ queryKey: ["messages", targetConversationId] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to forward message.");
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

    displayMessages.forEach((msg) => {
      const dateLabel = formatDateSeparator(msg.created_at);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === dateLabel) {
        lastGroup.items.push(msg);
      } else {
        groups.push({ date: dateLabel, items: [msg] });
      }
    });

    return groups;
  }, [displayMessages]);

  const directPeer = useMemo(() => {
    if (!selectedConversation || selectedConversation.kind === "group") return null;
    return selectedConversation.members.find((m) => m.user_id !== currentUserId) ?? null;
  }, [selectedConversation, currentUserId]);

  const isDirectPeerOnline = Boolean(directPeer && isOnline(directPeer.user_id));

  const directPeerLastSeen = directPeer
    ? getEffectiveLastSeen(directPeer.user_id, extractProfileLastSeen(directPeer.profile))
    : null;

  const directPeerLastReadAt = directPeer?.last_read_at ?? null;

  const groupOnlineCount = useMemo(() => {
    if (!selectedConversation || selectedConversation.kind !== "group") return 0;
    return selectedConversation.members.filter((m) => isOnline(m.user_id)).length;
  }, [selectedConversation, isOnline]);

  const currentMemberRole: GroupRole = useMemo(() => {
    if (!selectedConversation) return "member";
    return getEffectiveRole(currentUserId, selectedConversation, selectedConversation.members);
  }, [selectedConversation, currentUserId]);

  const isCurrentGroupAdmin =
    currentMemberRole === "owner" ||
    currentMemberRole === "admin" ||
    currentMemberRole === "moderator";

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
    <div
      className={`mx-auto flex max-w-7xl flex-col ${
        selectedConversation
          ? "p-0 md:p-6 h-[100dvh] md:h-[calc(100dvh-40px)]"
          : "p-2 sm:p-4 md:p-6 h-[calc(100dvh-75px)] md:h-[calc(100dvh-40px)]"
      }`}
    >
      {/* TOP BAR / HEADER (Hidden on mobile when conversation is active) */}
      <div
        className={`${
          selectedConversation ? "hidden md:flex" : "flex"
        } mb-3 items-center justify-between`}
      >
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
      <div
        className={`grid min-h-0 flex-1 overflow-hidden bg-card shadow-sm ${
          selectedConversation
            ? "border-0 rounded-none md:rounded-2xl md:border md:border-border md:grid-cols-[340px_1fr]"
            : "rounded-2xl border border-border md:grid-cols-[340px_1fr]"
        }`}
      >
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
                !isGroup && Boolean(otherMember && isOnline(otherMember.user_id));
              const peerLastSeen =
                !isGroup && otherMember
                  ? getEffectiveLastSeen(
                      otherMember.user_id,
                      extractProfileLastSeen(otherMember.profile),
                    )
                  : null;
              const convGroupOnlineCount = isGroup
                ? conv.members.filter((m) => isOnline(m.user_id)).length
                : 0;

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
                  lastMsgSnippet = formatMessageTextForPreview(conv.lastMessage.content);
                }
              }

              return (
                <div
                  key={conv.id}
                  className={`group flex w-full items-center justify-between p-3 text-left transition select-none ${
                    active ? "bg-[#E91E63]/10" : "hover:bg-secondary/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectConversation(conv)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
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

                      {!isGroup && (
                        <PresenceDot
                          isOnline={isPeerOnline}
                          lastSeenAt={peerLastSeen}
                          size="md"
                          className="absolute bottom-0 right-0"
                        />
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
                        <p className="truncate text-[11px] text-muted-foreground">
                          {lastMsgSnippet}
                        </p>
                        {Boolean(conv.unreadCount && conv.unreadCount > 0) && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E91E63] px-1 text-[10px] font-bold text-white shadow-xs">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>

                      {!isGroup ? (
                        <div className="mt-0.5">
                          <PresenceStatusText
                            isOnline={isPeerOnline}
                            lastSeenAt={peerLastSeen}
                            nowMs={nowMs}
                            className="text-[10px]"
                          />
                        </div>
                      ) : (
                        convGroupOnlineCount > 0 && (
                          <p className="mt-0.5 text-[10px] text-[#22C55E] font-medium">
                            {convGroupOnlineCount} online
                          </p>
                        )
                      )}
                    </div>
                  </button>

                  {/* 3-dots menu for sidebar conversation */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Chat options"
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary opacity-100 md:opacity-0 md:group-hover:opacity-100 transition shrink-0 ml-1"
                        title="Chat options"
                      >
                        <MoreVertical size={15} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 text-xs">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setSidebarTargetConv(conv);
                          setSidebarClearChatOpen(true);
                        }}
                        className="gap-2 cursor-pointer"
                      >
                        <Eraser size={13} className="text-muted-foreground" />
                        <span>Clear chat history</span>
                      </DropdownMenuItem>
                      {!isGroup ? (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setSidebarTargetConv(conv);
                            setSidebarDeleteConvOpen(true);
                          }}
                          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Delete conversation</span>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedConversation(conv);
                            setGroupDetailsOpen(true);
                          }}
                          className="gap-2 cursor-pointer"
                        >
                          <Users size={13} className="text-muted-foreground" />
                          <span>Group details</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ================= RIGHT CHAT WINDOW ================= */}
        <section
          className={`${
            selectedConversation
              ? "fixed inset-0 z-40 flex flex-col bg-background md:relative md:inset-auto md:z-auto md:h-full md:bg-background/50"
              : "hidden md:flex min-h-0 flex-col bg-background/50 relative"
          }`}
          style={
            selectedConversation &&
            viewportHeight &&
            typeof window !== "undefined" &&
            window.innerWidth < 768
              ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` }
              : undefined
          }
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
                lastSeenAt={directPeerLastSeen}
                onlineMemberCount={groupOnlineCount}
                typingUsers={activeTypingNames}
                isOwner={currentMemberRole === "owner"}
                onBack={handleBackFromChat}
                onOpenDetails={() => setGroupDetailsOpen(true)}
                onClearChat={handleClearChat}
                onDeleteConversation={handleDeleteConversation}
                onLeaveGroup={() => setGroupDetailsOpen(true)}
                onDeleteGroup={handleDeleteGroup}
              />

              {/* MESSAGES SCROLL CONTAINER */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-4"
              >
                {messagesQuery.isLoading && (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 size={20} className="animate-spin text-[#E91E63]" />
                    <p className="text-xs">Loading message history...</p>
                  </div>
                )}

                {!messagesQuery.isLoading && displayMessages.length === 0 && (
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
                        senderRole={
                          selectedConversation.kind === "group"
                            ? getEffectiveRole(
                                msg.sender_id,
                                selectedConversation,
                                selectedConversation.members,
                              )
                            : undefined
                        }
                        peerLastReadAt={directPeerLastReadAt}
                        onReply={(m) => {
                          setEditingMessageState(null);
                          setReplyingTo(m);
                        }}
                        onEdit={(m) => {
                          setReplyingTo(null);
                          setEditingMessageState(m);
                        }}
                        onDelete={(m) => {
                          setDeletingMessage(m);
                          setDeleteModalOpen(true);
                        }}
                        onForward={(m) => {
                          setForwardingMessage(m);
                          setForwardModalOpen(true);
                        }}
                        onToggleReaction={handleToggleReaction}
                        onLocateMessage={handleLocateMessage}
                        onRetry={handleRetryFailedMessage}
                        onDismissFailed={handleDismissFailedMessage}
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
                      {selectedConversation.kind !== "group"
                        ? "Typing..."
                        : activeTypingNames.length === 1
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
                  className="absolute bottom-16 right-4 sm:bottom-20 sm:right-6 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#E91E63] text-white shadow-xl hover:bg-[#C2185B] transition active:scale-95"
                  title="Jump to latest"
                >
                  <ChevronDown size={18} />
                </button>
              )}

              {/* CHAT COMPOSER */}
              <ChatComposer
                onSendMessage={handleSendMessage}
                onTyping={handleBroadcastTyping}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                editingMessage={editingMessageState}
                onCancelEdit={() => setEditingMessageState(null)}
                isSending={isEditingPending}
              />

              {/* GROUP DETAILS SHEET */}
              {selectedConversation.kind === "group" && (
                <GroupDetailsSheet
                  open={groupDetailsOpen}
                  onOpenChange={setGroupDetailsOpen}
                  conversation={selectedConversation}
                  currentUserId={currentUserId}
                  onConversationUpdated={async () => {
                    await queryClient.invalidateQueries({
                      queryKey: ["messages", "conversations"],
                    });
                    await queryClient.refetchQueries({ queryKey: ["messages", "conversations"] });
                  }}
                  onLeftGroup={() => {
                    setSelectedConversation(null);
                    queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
                  }}
                  onGroupDeleted={() => {
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

      {/* FORWARD MESSAGE MODAL */}
      <ForwardMessageModal
        open={forwardModalOpen}
        onOpenChange={setForwardModalOpen}
        message={forwardingMessage}
        conversations={conversations}
        currentUserId={currentUserId}
        onForward={handleForwardMessage}
      />

      {/* DELETE MESSAGE DIALOG (Delete for me vs Delete for everyone) */}
      <DeleteMessageDialog
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        message={deletingMessage}
        currentUserId={currentUserId}
        isGroupAdmin={isCurrentGroupAdmin}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
      />

      {/* SIDEBAR CONFIRMATION: Clear Chat */}
      <AlertDialog open={sidebarClearChatOpen} onOpenChange={setSidebarClearChatOpen}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl bg-card border-border p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display text-base text-foreground">
              <Eraser size={18} className="text-[#E91E63]" />
              Clear chat history?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Messages will be cleared for you. Other participants will not lose their history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="text-xs rounded-xl h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sidebarTargetConv) handleClearChat(sidebarTargetConv.id);
                setSidebarClearChatOpen(false);
              }}
              className="text-xs rounded-xl h-8 bg-[#E91E63] hover:bg-[#C2185B] text-white"
            >
              Clear Messages
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SIDEBAR CONFIRMATION: Delete Conversation */}
      <AlertDialog open={sidebarDeleteConvOpen} onOpenChange={setSidebarDeleteConvOpen}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl bg-card border-border p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display text-base text-foreground">
              <Trash2 size={18} className="text-destructive" />
              Delete conversation?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This conversation will be hidden from your chat list. It will reappear if a new
              message arrives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="text-xs rounded-xl h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sidebarTargetConv) handleDeleteConversation(sidebarTargetConv.id);
                setSidebarDeleteConvOpen(false);
              }}
              className="text-xs rounded-xl h-8 bg-destructive hover:bg-destructive/90 text-white"
            >
              Delete Conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
