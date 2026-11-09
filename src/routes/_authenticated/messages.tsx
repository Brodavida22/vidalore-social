import { useEffect, useState, useRef, useMemo, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  MessageCircle,
  Send,
  RefreshCw,
  Search,
  UserPlus,
  X,
  Loader2,
  Check,
  CheckCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import {
  getMyConversations,
  getConversationMessages,
  sendTextMessage,
  subscribeToMessages,
  subscribeToMessageReads,
  markMessagesAsRead,
  createDirectConversation,
} from "@/services/messages";

import type {
  ConversationListItem,
  Message,
  MessageWithReads,
  MessageRead,
  Profile,
} from "@/services/messages";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

type SearchProfile = Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;

async function searchProfiles(term: string): Promise<SearchProfile[]> {
  const cleaned = term.trim();

  if (cleaned.length < 2) return [];

  const pattern = `%${cleaned}%`;

  const [usernameResult, displayNameResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .ilike("username", pattern)
      .limit(15),

    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .ilike("display_name", pattern)
      .limit(15),
  ]);

  if (usernameResult.error) throw usernameResult.error;
  if (displayNameResult.error) throw displayNameResult.error;

  const combined = [...(usernameResult.data ?? []), ...(displayNameResult.data ?? [])];

  const uniqueProfiles = new Map<string, SearchProfile>();

  for (const profile of combined) {
    uniqueProfiles.set(profile.id, profile as SearchProfile);
  }

  return Array.from(uniqueProfiles.values()).slice(0, 15);
}

function getOtherMember(conversation: ConversationListItem, currentUserId: string) {
  return conversation.members.find((member) => member.user_id !== currentUserId);
}

/* DISPLAY COMPLETE ERROR DETAILS */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const details = error as Record<string, unknown>;

    const parts = [
      details.message,
      details.code ? `Code: ${details.code}` : null,
      details.details,
      details.hint,
    ].filter((item) => typeof item === "string" && item.trim().length > 0);

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "An unknown error occurred. Check the browser console.";
    }
  }

  return String(error || "Unknown error. Check the browser console.");
}

interface AuthDiagnostic {
  sessionExists: boolean;
  sessionUserId: string | null;
  applicationUserId: string | null;
  userMatches: boolean;
  requestRole: string;
  databaseRecognizesUser: boolean;
  runtimeCreatedByMatchesAuthUserId: boolean;
  diagnosticDetails?: string;
  checkedAt?: string;
}

async function runAuthDiagnostic(currentUserId: string): Promise<AuthDiagnostic> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const { data: userData } = await supabase.auth.getUser();

    const session = sessionData?.session ?? null;
    const sessionExists = Boolean(session);
    const sessionUserId = session?.user?.id ?? null;
    const runtimeUser = userData?.user ?? null;
    const runtimeCreatedBy = runtimeUser?.id ?? null;
    const applicationUserId = currentUserId || null;
    const userMatches = Boolean(
      sessionUserId && applicationUserId && sessionUserId === applicationUserId,
    );

    // Verify whether runtime created_by matches the authenticated database user ID
    const runtimeCreatedByMatchesAuthUserId = Boolean(
      runtimeCreatedBy && sessionUserId && runtimeCreatedBy === sessionUserId,
    );

    // Determine database request role from JWT claims or user object
    let requestRole = "anon";
    if (session?.user?.role) {
      requestRole = session.user.role;
    } else if (session?.access_token) {
      try {
        const parts = session.access_token.split(".");
        if (parts[1]) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          if (typeof payload.role === "string") {
            requestRole = payload.role;
          }
        }
      } catch {
        requestRole = sessionExists ? "authenticated" : "anon";
      }
    } else if (sessionExists) {
      requestRole = "authenticated";
    }

    // Verify whether database recognizes the authenticated user
    let databaseRecognizesUser = false;
    let diagnosticDetails = "";

    if (sessionUserId) {
      // 1. Check private_profiles which enforces USING (auth.uid() = id)
      const { data: priv, error: privErr } = await supabase
        .from("private_profiles")
        .select("id")
        .eq("id", sessionUserId)
        .maybeSingle();

      if (!privErr && priv) {
        databaseRecognizesUser = true;
        diagnosticDetails =
          "Database recognized user via private_profiles (auth.uid() matched session user ID).";
      } else {
        // 2. Check profiles table which requires authenticated role
        const { data: pub, error: pubErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", sessionUserId)
          .maybeSingle();

        if (!pubErr && pub) {
          databaseRecognizesUser = true;
          diagnosticDetails =
            "Database recognized request as authenticated role via profiles table.";
        } else {
          diagnosticDetails =
            privErr?.message ||
            pubErr?.message ||
            sessionError?.message ||
            "Database query returned no rows or permission denied under current RLS.";
        }
      }
    } else {
      diagnosticDetails = sessionError?.message || "No active session user ID found.";
    }

    return {
      sessionExists,
      sessionUserId,
      applicationUserId,
      userMatches,
      requestRole,
      databaseRecognizesUser,
      runtimeCreatedByMatchesAuthUserId,
      diagnosticDetails,
      checkedAt: new Date().toLocaleTimeString(),
    };
  } catch (err) {
    return {
      sessionExists: false,
      sessionUserId: null,
      applicationUserId: currentUserId || null,
      userMatches: false,
      requestRole: "unknown",
      databaseRecognizesUser: false,
      runtimeCreatedByMatchesAuthUserId: false,
      diagnosticDetails: err instanceof Error ? err.message : String(err),
      checkedAt: new Date().toLocaleTimeString(),
    };
  }
}

function MessagesPage() {
  const queryClient = useQueryClient();

  const [selectedConversation, setSelectedConversation] = useState<ConversationListItem | null>(
    null,
  );

  const [messageText, setMessageText] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [searchText, setSearchText] = useState("");

  const [startingChatUser, setStartingChatUser] = useState<string | null>(null);
  const [authDiagnostic, setAuthDiagnostic] = useState<AuthDiagnostic | null>(null);

  /* LOAD SIGNED-IN USER */
  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        console.error("Current user error:", error);
        return;
      }

      setCurrentUserId(data.user?.id ?? "");
    });

    return () => {
      active = false;
    };
  }, []);

  /* LOAD CONVERSATIONS */
  const conversationsQuery = useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: getMyConversations,
  });

  const conversations = conversationsQuery.data ?? [];

  const selectedId = selectedConversation?.id ?? "";

  /* LOAD MESSAGES */
  const messagesQuery = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: () => getConversationMessages(selectedId),
    enabled: Boolean(selectedId),
  });

  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  /* SEARCH USERS */
  const searchQuery = useQuery({
    queryKey: ["messages", "user-search", searchText.trim()],
    queryFn: () => searchProfiles(searchText),
    enabled: searchText.trim().length >= 2,
    staleTime: 15000,
  });

  const markedReadIdsRef = useRef<Set<string>>(new Set());

  // Clear marked read set when switching conversations
  useEffect(() => {
    markedReadIdsRef.current.clear();
  }, [selectedId]);

  /* REALTIME MESSAGE SUBSCRIPTION */
  useEffect(() => {
    if (!selectedId) return;

    const unsubscribe = subscribeToMessages(selectedId, (newMessage) => {
      queryClient.setQueryData<MessageWithReads[]>(["messages", selectedId], (oldMessages = []) => {
        if (oldMessages.some((message) => message.id === newMessage.id)) {
          return oldMessages;
        }

        const messageWithReads: MessageWithReads = {
          ...newMessage,
          reads: [],
        };

        return [...oldMessages, messageWithReads];
      });

      // Automatically mark incoming messages as read if the conversation is actively open
      if (currentUserId && newMessage.sender_id !== currentUserId) {
        markedReadIdsRef.current.add(newMessage.id);
        void markMessagesAsRead(selectedId, [newMessage.id]);
      }

      queryClient.invalidateQueries({
        queryKey: ["messages", "conversations"],
      });
    });

    return unsubscribe;
  }, [selectedId, currentUserId, queryClient]);

  /* REALTIME READ RECEIPTS SUBSCRIPTION */
  useEffect(() => {
    if (!selectedId) return;

    const unsubscribe = subscribeToMessageReads((newRead: MessageRead) => {
      queryClient.setQueryData<MessageWithReads[]>(["messages", selectedId], (oldMessages = []) => {
        if (!oldMessages.some((msg) => msg.id === newRead.message_id)) {
          return oldMessages;
        }

        return oldMessages.map((msg) => {
          if (msg.id === newRead.message_id) {
            const existingReads = msg.reads ?? [];
            if (existingReads.some((r) => r.user_id === newRead.user_id)) {
              return msg;
            }
            return {
              ...msg,
              reads: [...existingReads, newRead],
            };
          }
          return msg;
        });
      });
    });

    return unsubscribe;
  }, [selectedId, queryClient]);

  /* AUTOMATIC READ DETECTION FOR INCOMING MESSAGES */
  useEffect(() => {
    if (!selectedId || !currentUserId || !messages.length) return;

    const unreadIncomingIds = messages
      .filter((msg) => {
        // Do not mark user's own messages as read by themselves
        if (msg.sender_id === currentUserId) return false;
        // Do not repeatedly insert duplicate read records
        if (markedReadIdsRef.current.has(msg.id)) return false;
        const alreadyReadByMe = (msg.reads ?? []).some((r) => r.user_id === currentUserId);
        return !alreadyReadByMe;
      })
      .map((msg) => msg.id);

    if (unreadIncomingIds.length > 0) {
      unreadIncomingIds.forEach((id) => markedReadIdsRef.current.add(id));
      void markMessagesAsRead(selectedId, unreadIncomingIds).catch((err) => {
        console.error("Failed to mark incoming messages as read:", err);
      });
    }
  }, [selectedId, currentUserId, messages]);

  /* SEND MESSAGE */
  const sendMutation = useMutation({
    mutationFn: (content: string) => sendTextMessage(selectedId, content),

    onSuccess: () => {
      setMessageText("");

      queryClient.invalidateQueries({
        queryKey: ["messages", selectedId],
      });

      queryClient.invalidateQueries({
        queryKey: ["messages", "conversations"],
      });
    },
  });

  /* START DIRECT CHAT */
  const startChatMutation = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!currentUserId) {
        throw new Error("Your account is still loading. Try again.");
      }

      if (!otherUserId) {
        throw new Error("The selected user's ID is missing.");
      }

      if (otherUserId === currentUserId) {
        throw new Error("You cannot chat with yourself.");
      }

      return createDirectConversation(otherUserId);
    },

    onMutate: (otherUserId) => {
      setStartingChatUser(otherUserId);
    },

    onSuccess: async (conversation) => {
      const updatedConversations = await getMyConversations();

      queryClient.setQueryData(["messages", "conversations"], updatedConversations);

      const matchingConversation = updatedConversations.find((item) => item.id === conversation.id);

      if (!matchingConversation) {
        throw new Error(
          "Conversation created, but membership could not be verified. Check the conversation_members permissions.",
        );
      }

      setSelectedConversation(matchingConversation);
      setSearchText("");
    },

    onError: (error) => {
      console.error("START CHAT ERROR:", error);
      console.error("ERROR DETAILS:", getErrorMessage(error));
      void runAuthDiagnostic(currentUserId).then(setAuthDiagnostic);
    },

    onSettled: () => {
      setStartingChatUser(null);
    },
  });

  /* RUN DIAGNOSTIC WHEN CHAT ERROR OCCURS */
  useEffect(() => {
    if (startChatMutation.isError && !authDiagnostic) {
      void runAuthDiagnostic(currentUserId).then(setAuthDiagnostic);
    }
  }, [startChatMutation.isError, authDiagnostic, currentUserId]);

  /* SEND FORM */
  function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = messageText.trim();

    if (!content || !selectedId || sendMutation.isPending) return;

    sendMutation.mutate(content);
  }

  function getConversationName(conversation: ConversationListItem) {
    if (conversation.kind === "group") {
      return conversation.title || "Group conversation";
    }

    const otherMember = getOtherMember(conversation, currentUserId);

    return (
      otherMember?.profile?.display_name || otherMember?.profile?.username || "New conversation"
    );
  }

  function getConversationAvatar(conversation: ConversationListItem) {
    if (conversation.kind === "group") {
      return conversation.image_url;
    }

    return getOtherMember(conversation, currentUserId)?.profile?.avatar_url;
  }

  function getMessagePreview(conversation: ConversationListItem) {
    const message = conversation.lastMessage;

    if (!message) return "Start a conversation";
    if (message.deleted_at) return "Message deleted";

    if (message.message_type !== "text") {
      return "Sent an attachment";
    }

    return message.content || "Message";
  }

  function isMessageReadByRecipient(message: MessageWithReads, userId: string): boolean {
    if (!message.reads || message.reads.length === 0) return false;
    return message.reads.some((read) => read.user_id !== userId);
  }

  function startChat(profile: SearchProfile) {
    if (!currentUserId || startChatMutation.isPending) return;

    startChatMutation.mutate(profile.id);
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-90px)] max-w-7xl flex-col p-3 md:h-[calc(100dvh-40px)] md:p-6">
      {/* HEADER */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#E91E63]/10 p-2.5 text-[#E91E63]">
            <MessageCircle size={22} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-foreground">Messages</h1>
            <p className="text-xs text-muted-foreground">Private and direct conversations.</p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[340px_1fr]">
        {/* LEFT SIDEBAR */}
        <aside
          className={`${
            selectedConversation ? "hidden md:flex" : "flex"
          } min-h-0 flex-col border-r border-border`}
        >
          <div className="border-b border-border p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Conversations</h2>

              <button
                type="button"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["messages", "conversations"],
                  })
                }
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                aria-label="Refresh conversations"
              >
                <RefreshCw size={15} />
              </button>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />

              <input
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  startChatMutation.reset();
                }}
                placeholder="Search people..."
                className="w-full rounded-xl border border-border bg-secondary/60 py-2 pl-9 pr-9 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-[#E91E63]"
                maxLength={50}
              />

              {searchText && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchText("");
                    startChatMutation.reset();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* SEARCH RESULTS */}
          {searchText.trim().length >= 2 && (
            <div className="border-b border-border bg-secondary/30">
              <div className="px-4 pb-1 pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#E91E63]">
                  People
                </p>
              </div>

              {searchQuery.isFetching && (
                <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
                  <Loader2 size={15} className="animate-spin text-[#E91E63]" />
                  Searching...
                </div>
              )}

              {searchQuery.isError && (
                <p className="break-words px-4 pb-3 text-xs text-destructive">
                  Search error: {getErrorMessage(searchQuery.error)}
                </p>
              )}

              {searchQuery.isSuccess && searchQuery.data.length === 0 && (
                <p className="px-4 pb-3 text-xs text-muted-foreground">No users found.</p>
              )}

              {searchQuery.data?.map((profile) => {
                const isStarting = startingChatUser === profile.id;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => startChat(profile)}
                    disabled={
                      !currentUserId || startChatMutation.isPending || profile.id === currentUserId
                    }
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-secondary disabled:opacity-50"
                  >
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#18181B] text-foreground border border-border">
                        <UserPlus size={16} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {profile.display_name || profile.username}
                      </p>

                      <p className="truncate text-[11px] text-muted-foreground">
                        @{profile.username}
                      </p>
                    </div>

                    {isStarting ? (
                      <Loader2 size={16} className="animate-spin text-[#E91E63]" />
                    ) : (
                      <MessageCircle size={16} className="text-[#E91E63]" />
                    )}
                  </button>
                );
              })}

              {!currentUserId && (
                <p className="px-4 pb-3 text-xs text-muted-foreground">Loading your account...</p>
              )}

              {/* FULL CHAT ERROR & AUTH DIAGNOSTIC */}
              {startChatMutation.isError && (
                <div className="mx-3 mb-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-destructive/20 pb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-destructive">
                      Chat Diagnostic
                    </p>
                    {authDiagnostic?.checkedAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {authDiagnostic.checkedAt}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 rounded-lg bg-card p-2 border border-border">
                    <p className="text-[11px] font-semibold text-destructive">Error Details:</p>
                    <p className="mt-1 break-words font-mono text-[11px] leading-4 text-foreground">
                      {getErrorMessage(startChatMutation.error)}
                    </p>
                  </div>

                  <div className="mt-2 space-y-1.5 border-t border-destructive/20 pt-2 text-xs">
                    <div className="flex items-center justify-between rounded-md bg-secondary/60 px-2 py-1">
                      <span className="text-muted-foreground">Session exists:</span>
                      <span
                        className={`font-semibold ${
                          authDiagnostic?.sessionExists ? "text-[#22C55E]" : "text-destructive"
                        }`}
                      >
                        {authDiagnostic?.sessionExists ? "Yes" : "No"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-md bg-secondary/60 px-2 py-1">
                      <span className="text-muted-foreground">User matches app user:</span>
                      <span
                        className={`font-semibold ${
                          authDiagnostic?.userMatches ? "text-[#22C55E]" : "text-[#F59E0B]"
                        }`}
                      >
                        {authDiagnostic?.userMatches ? "Yes" : "No"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-md bg-secondary/60 px-2 py-1">
                      <span className="text-muted-foreground">Request role:</span>
                      <span
                        className={`font-mono font-semibold ${
                          authDiagnostic?.requestRole === "authenticated"
                            ? "text-[#22C55E]"
                            : "text-[#F59E0B]"
                        }`}
                      >
                        {authDiagnostic ? authDiagnostic.requestRole : "Checking..."}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-md bg-secondary/60 px-2 py-1">
                      <span className="text-muted-foreground">Database recognizes user:</span>
                      <span
                        className={`font-semibold ${
                          authDiagnostic?.databaseRecognizesUser
                            ? "text-[#22C55E]"
                            : "text-destructive"
                        }`}
                      >
                        {authDiagnostic?.databaseRecognizesUser ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 pt-1 border-t border-destructive/20">
                    <button
                      type="button"
                      onClick={() => {
                        void runAuthDiagnostic(currentUserId).then(setAuthDiagnostic);
                      }}
                      className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary/80"
                    >
                      Re-run
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        startChatMutation.reset();
                        setAuthDiagnostic(null);
                      }}
                      className="rounded-lg bg-[#E91E63]/20 px-2.5 py-1 text-xs font-semibold text-[#E91E63] hover:bg-[#E91E63]/30"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONVERSATION LIST */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isLoading && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Loading conversations...
              </div>
            )}

            {conversationsQuery.isError && (
              <div className="p-5 text-center">
                <p className="text-xs text-destructive">
                  {getErrorMessage(conversationsQuery.error)}
                </p>

                <button
                  type="button"
                  onClick={() => conversationsQuery.refetch()}
                  className="mt-2 text-xs font-medium text-[#E91E63] hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {!conversationsQuery.isLoading &&
              !conversationsQuery.isError &&
              conversations.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E91E63]/10 text-[#E91E63]">
                    <MessageCircle size={24} />
                  </div>

                  <h3 className="text-sm font-semibold text-foreground">No conversations yet</h3>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Search for someone above to start a conversation.
                  </p>
                </div>
              )}

            {conversations.map((conversation) => {
              const avatar = getConversationAvatar(conversation);
              const name = getConversationName(conversation);
              const active = selectedConversation?.id === conversation.id;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversation(conversation)}
                  className={`flex w-full items-center gap-3 border-b border-border/50 p-3.5 text-left transition ${
                    active ? "bg-[#E91E63]/10" : "hover:bg-secondary/50"
                  }`}
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground border border-border">
                      <MessageCircle size={18} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{name}</p>

                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {getMessagePreview(conversation)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* CHAT WINDOW */}
        <section
          className={`${selectedConversation ? "flex" : "hidden md:flex"} min-h-0 flex-col bg-background/50`}
        >
          {!selectedConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E91E63]/10 text-[#E91E63]">
                <MessageCircle size={32} />
              </div>

              <h2 className="text-base font-bold text-foreground">Your Messages</h2>

              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Select a conversation from the sidebar or search for someone to start chatting.
              </p>
            </div>
          ) : (
            <>
              {/* CHAT HEADER */}
              <div className="flex items-center gap-3 border-b border-border p-3.5 bg-card">
                <button
                  type="button"
                  onClick={() => setSelectedConversation(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>

                {getConversationAvatar(selectedConversation) ? (
                  <img
                    src={getConversationAvatar(selectedConversation)!}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
                    <MessageCircle size={16} />
                  </div>
                )}

                <div>
                  <h2 className="text-xs font-semibold text-foreground">
                    {getConversationName(selectedConversation)}
                  </h2>

                  <p className="text-[11px] text-muted-foreground">
                    {selectedConversation.kind === "group"
                      ? `${selectedConversation.members.length} members`
                      : "Direct message"}
                  </p>
                </div>
              </div>

              {/* MESSAGE HISTORY */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messagesQuery.isLoading && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Loading messages...
                  </p>
                )}

                {messagesQuery.isError && (
                  <div className="py-8 text-center">
                    <p className="break-words text-xs text-destructive">
                      {getErrorMessage(messagesQuery.error)}
                    </p>

                    <button
                      type="button"
                      onClick={() => messagesQuery.refetch()}
                      className="mt-2 text-xs font-medium text-[#E91E63] hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {!messagesQuery.isLoading && !messagesQuery.isError && messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <MessageCircle size={28} className="mb-2 text-[#E91E63]" />

                    <p className="text-xs font-medium text-foreground">No messages yet</p>

                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Send the first message.
                    </p>
                  </div>
                )}

                {messages.map((message) => {
                  const isMine = message.sender_id === currentUserId;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                          isMine
                            ? "rounded-br-sm bg-[#E91E63] text-white"
                            : "rounded-bl-sm border border-border bg-card text-foreground"
                        }`}
                      >
                        {message.deleted_at ? (
                          <p className="text-xs italic opacity-70">Message deleted</p>
                        ) : message.message_type === "text" ? (
                          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                            {message.content}
                          </p>
                        ) : (
                          <p className="text-xs">
                            Attachment: {message.media_name || message.message_type}
                          </p>
                        )}

                        <div
                          className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                            isMine ? "text-white/80" : "text-muted-foreground"
                          }`}
                        >
                          <span>
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {message.edited_at ? " · Edited" : ""}
                          </span>

                          {/* WhatsApp-style read receipt status */}
                          {isMine && (
                            <span
                              className="inline-flex items-center select-none"
                              title={
                                isMessageReadByRecipient(message, currentUserId)
                                  ? "Read by recipient"
                                  : "Saved to server"
                              }
                            >
                              {isMessageReadByRecipient(message, currentUserId) ? (
                                <CheckCheck
                                  size={13}
                                  className="text-white drop-shadow-sm transition-colors duration-200"
                                />
                              ) : (
                                <Check
                                  size={13}
                                  className="text-white/60 transition-colors duration-200"
                                />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MESSAGE COMPOSER */}
              <form onSubmit={handleSendMessage} className="border-t border-border p-3 bg-card">
                {sendMutation.isError && (
                  <p className="mb-2 break-words px-2 text-xs text-destructive">
                    {getErrorMessage(sendMutation.error)}
                  </p>
                )}

                <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 p-1.5">
                  <input
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Write a message..."
                    className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
                    maxLength={5000}
                    disabled={sendMutation.isPending}
                  />

                  <button
                    type="submit"
                    disabled={!messageText.trim() || sendMutation.isPending}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E91E63] text-white transition hover:bg-[#C2185B] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Send message"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
