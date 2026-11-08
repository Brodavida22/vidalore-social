import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  MessageCircle,
  Send,
  RefreshCw,
  Search,
  UserPlus,
  X,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import {
  getMyConversations,
  getConversationMessages,
  sendTextMessage,
  subscribeToMessages,
  createDirectConversation,
} from "@/services/messages";

import type {
  ConversationListItem,
  Message,
  Profile,
} from "@/services/messages";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

type SearchProfile = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url"
>;

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

  const combined = [
    ...(usernameResult.data ?? []),
    ...(displayNameResult.data ?? []),
  ];

  const uniqueProfiles = new Map<string, SearchProfile>();

  for (const profile of combined) {
    uniqueProfiles.set(profile.id, profile as SearchProfile);
  }

  return Array.from(uniqueProfiles.values()).slice(0, 15);
}

function getOtherMember(
  conversation: ConversationListItem,
  currentUserId: string
) {
  return conversation.members.find(
    (member) => member.user_id !== currentUserId
  );
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
    ].filter(
      (item) =>
        typeof item === "string" && item.trim().length > 0
    );

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

function MessagesPage() {
  const queryClient = useQueryClient();

  const [selectedConversation, setSelectedConversation] =
    useState<ConversationListItem | null>(null);

  const [messageText, setMessageText] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [searchText, setSearchText] = useState("");

  const [startingChatUser, setStartingChatUser] = useState<string | null>(
    null
  );

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

  const messages = messagesQuery.data ?? [];

  /* SEARCH USERS */
  const searchQuery = useQuery({
    queryKey: ["messages", "user-search", searchText.trim()],
    queryFn: () => searchProfiles(searchText),
    enabled: searchText.trim().length >= 2,
    staleTime: 15000,
  });

  /* REALTIME MESSAGE SUBSCRIPTION */
  useEffect(() => {
    if (!selectedId) return;

    const unsubscribe = subscribeToMessages(
      selectedId,
      (newMessage) => {
        queryClient.setQueryData<Message[]>(
          ["messages", selectedId],
          (oldMessages = []) => {
            if (
              oldMessages.some(
                (message) => message.id === newMessage.id
              )
            ) {
              return oldMessages;
            }

            return [...oldMessages, newMessage];
          }
        );

        queryClient.invalidateQueries({
          queryKey: ["messages", "conversations"],
        });
      }
    );

    return unsubscribe;
  }, [selectedId, queryClient]);

  /* SEND MESSAGE */
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      sendTextMessage(selectedId, content),

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

      queryClient.setQueryData(
        ["messages", "conversations"],
        updatedConversations
      );

      const matchingConversation = updatedConversations.find(
        (item) => item.id === conversation.id
      );

      if (!matchingConversation) {
        throw new Error(
          "Conversation created, but membership could not be verified. Check the conversation_members permissions."
        );
      }

      setSelectedConversation(matchingConversation);
      setSearchText("");
    },

    onError: (error) => {
      console.error("START CHAT ERROR:", error);
      console.error("ERROR DETAILS:", getErrorMessage(error));
    },

    onSettled: () => {
      setStartingChatUser(null);
    },
  });

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

    const otherMember = getOtherMember(
      conversation,
      currentUserId
    );

    return (
      otherMember?.profile?.display_name ||
      otherMember?.profile?.username ||
      "New conversation"
    );
  }

  function getConversationAvatar(conversation: ConversationListItem) {
    if (conversation.kind === "group") {
      return conversation.image_url;
    }

    return getOtherMember(
      conversation,
      currentUserId
    )?.profile?.avatar_url;
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

  function startChat(profile: SearchProfile) {
    if (!currentUserId || startChatMutation.isPending) return;

    startChatMutation.mutate(profile.id);
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-90px)] max-w-7xl flex-col p-3 md:h-[calc(100dvh-40px)] md:p-6">

      {/* HEADER */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-pink-500/15 p-3 text-pink-400">
            <MessageCircle size={25} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white">
              Messages
            </h1>

            <p className="text-sm text-gray-400">
              Connect privately with your people.
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-[#110d12] md:grid-cols-[340px_1fr]">

        {/* LEFT SIDEBAR */}
        <aside
          className={`${
            selectedConversation ? "hidden md:flex" : "flex"
          } min-h-0 flex-col border-r border-white/10`}
        >
          <div className="border-b border-white/10 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">
                Your conversations
              </h2>

              <button
                type="button"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["messages", "conversations"],
                  })
                }
                className="rounded-xl p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="Refresh conversations"
              >
                <RefreshCw size={17} />
              </button>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />

              <input
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  startChatMutation.reset();
                }}
                placeholder="Search people by name or username..."
                className="w-full rounded-xl border border-white/10 bg-[#211923] py-3 pl-10 pr-10 text-sm text-white outline-none placeholder:text-gray-500 focus:border-pink-500/60"
                maxLength={50}
              />

              {searchText && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchText("");
                    startChatMutation.reset();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-label="Clear search"
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>

          {/* SEARCH RESULTS */}
          {searchText.trim().length >= 2 && (
            <div className="border-b border-white/10">
              <div className="px-4 pb-2 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400">
                  People
                </p>
              </div>

              {searchQuery.isFetching && (
                <div className="flex items-center justify-center gap-2 p-5 text-sm text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                  Searching...
                </div>
              )}

              {searchQuery.isError && (
                <p className="break-words px-4 pb-4 text-sm text-red-400">
                  Search error: {getErrorMessage(searchQuery.error)}
                </p>
              )}

              {searchQuery.isSuccess &&
                searchQuery.data.length === 0 && (
                  <p className="px-4 pb-4 text-sm text-gray-400">
                    No users found.
                  </p>
                )}

              {searchQuery.data?.map((profile) => {
                const isStarting =
                  startingChatUser === profile.id;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => startChat(profile)}
                    disabled={
                      !currentUserId ||
                      startChatMutation.isPending ||
                      profile.id === currentUserId
                    }
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-pink-500/10 disabled:opacity-50"
                  >
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-900 text-white">
                        <UserPlus size={19} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {profile.display_name || profile.username}
                      </p>

                      <p className="truncate text-xs text-gray-400">
                        @{profile.username}
                      </p>
                    </div>

                    {isStarting ? (
                      <Loader2
                        size={18}
                        className="animate-spin text-pink-400"
                      />
                    ) : (
                      <MessageCircle
                        size={18}
                        className="text-pink-400"
                      />
                    )}
                  </button>
                );
              })}

              {!currentUserId && (
                <p className="px-4 pb-3 text-xs text-gray-500">
                  Loading your account...
                </p>
              )}

              {/* FULL CHAT ERROR */}
              {startChatMutation.isError && (
                <div className="mx-4 mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-xs font-bold text-red-400">
                    CHAT ERROR — DETAILS BELOW
                  </p>

                  <p className="mt-2 break-all text-xs leading-5 text-red-300">
                    {getErrorMessage(startChatMutation.error)}
                  </p>

                  <button
                    type="button"
                    onClick={() => startChatMutation.reset()}
                    className="mt-3 text-xs font-semibold text-pink-400"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CONVERSATION LIST */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isLoading && (
              <div className="p-6 text-center text-sm text-gray-400">
                Loading conversations...
              </div>
            )}

            {conversationsQuery.isError && (
              <div className="p-5 text-center">
                <p className="text-sm text-red-400">
                  {getErrorMessage(conversationsQuery.error)}
                </p>

                <button
                  type="button"
                  onClick={() => conversationsQuery.refetch()}
                  className="mt-3 text-sm text-pink-400"
                >
                  Try again
                </button>
              </div>
            )}

            {!conversationsQuery.isLoading &&
              !conversationsQuery.isError &&
              conversations.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-500/10 text-pink-400">
                    <MessageCircle size={28} />
                  </div>

                  <h3 className="font-semibold text-white">
                    No conversations yet
                  </h3>

                  <p className="mt-2 text-sm text-gray-400">
                    Search for someone above to start your first conversation.
                  </p>
                </div>
              )}

            {conversations.map((conversation) => {
              const avatar = getConversationAvatar(conversation);
              const name = getConversationName(conversation);

              const active =
                selectedConversation?.id === conversation.id;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversation(conversation)}
                  className={`flex w-full items-center gap-3 border-b border-white/5 p-4 text-left transition ${
                    active ? "bg-pink-500/10" : "hover:bg-white/5"
                  }`}
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-900 text-white">
                      <MessageCircle size={20} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {name}
                    </p>

                    <p className="mt-1 truncate text-sm text-gray-400">
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
          className={`${
            selectedConversation ? "flex" : "hidden md:flex"
          } min-h-0 flex-col`}
        >
          {!selectedConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-rose-900/20 text-pink-400">
                <MessageCircle size={42} />
              </div>

              <h2 className="text-xl font-bold text-white">
                Welcome to VIDALORE Messages
              </h2>

              <p className="mt-2 max-w-sm text-sm text-gray-400">
                Select a conversation or search for someone to start chatting.
              </p>
            </div>
          ) : (
            <>
              {/* CHAT HEADER */}
              <div className="flex items-center gap-3 border-b border-white/10 p-4">
                <button
                  type="button"
                  onClick={() => setSelectedConversation(null)}
                  className="rounded-xl p-2 text-gray-400 hover:bg-white/10 md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={20} />
                </button>

                {getConversationAvatar(selectedConversation) ? (
                  <img
                    src={getConversationAvatar(selectedConversation)!}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-500/20 text-pink-400">
                    <MessageCircle size={19} />
                  </div>
                )}

                <div>
                  <h2 className="font-semibold text-white">
                    {getConversationName(selectedConversation)}
                  </h2>

                  <p className="text-xs text-gray-400">
                    {selectedConversation.kind === "group"
                      ? `${selectedConversation.members.length} members`
                      : "Private conversation"}
                  </p>
                </div>
              </div>

              {/* MESSAGE HISTORY */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messagesQuery.isLoading && (
                  <p className="py-8 text-center text-sm text-gray-400">
                    Loading messages...
                  </p>
                )}

                {messagesQuery.isError && (
                  <div className="py-8 text-center">
                    <p className="break-words text-sm text-red-400">
                      {getErrorMessage(messagesQuery.error)}
                    </p>

                    <button
                      type="button"
                      onClick={() => messagesQuery.refetch()}
                      className="mt-3 text-sm text-pink-400"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {!messagesQuery.isLoading &&
                  !messagesQuery.isError &&
                  messages.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MessageCircle
                        size={35}
                        className="mb-3 text-pink-400"
                      />

                      <p className="font-medium text-white">
                        No messages yet
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Send the first message.
                      </p>
                    </div>
                  )}

                {messages.map((message) => {
                  const isMine =
                    message.sender_id === currentUserId;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        isMine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          isMine
                            ? "rounded-br-md bg-gradient-to-br from-pink-600 to-rose-800 text-white"
                            : "rounded-bl-md border border-white/10 bg-[#211923] text-gray-100"
                        }`}
                      >
                        {message.deleted_at ? (
                          <p className="text-sm italic opacity-70">
                            Message deleted
                          </p>
                        ) : message.message_type === "text" ? (
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {message.content}
                          </p>
                        ) : (
                          <p className="text-sm">
                            Attachment:{" "}
                            {message.media_name || message.message_type}
                          </p>
                        )}

                        <p className="mt-1 text-right text-[10px] opacity-60">
                          {new Date(message.created_at).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                          {message.edited_at ? " · Edited" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MESSAGE COMPOSER */}
              <form
                onSubmit={handleSendMessage}
                className="border-t border-white/10 p-3"
              >
                {sendMutation.isError && (
                  <p className="mb-2 break-words px-2 text-xs text-red-400">
                    {getErrorMessage(sendMutation.error)}
                  </p>
                )}

                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#211923] p-2">
                  <input
                    value={messageText}
                    onChange={(event) =>
                      setMessageText(event.target.value)
                    }
                    placeholder="Write a message..."
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
                    maxLength={5000}
                    disabled={sendMutation.isPending}
                  />

                  <button
                    type="submit"
                    disabled={
                      !messageText.trim() || sendMutation.isPending
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-700 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Send message"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
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
