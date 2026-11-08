import { useEffect, useState } from "react";
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
} from "lucide-react";

import {
  getMyConversations,
  getConversationMessages,
  sendTextMessage,
  subscribeToMessages,
} from "@/services/messages";

import type {
  ConversationListItem,
  Message,
} from "@/services/messages";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function getOtherMember(
  conversation: ConversationListItem,
  currentUserId: string
) {
  return conversation.members.find(
    (member) => member.user_id !== currentUserId
  );
}

function MessagesPage() {
  const queryClient = useQueryClient();

  const [selectedConversation, setSelectedConversation] =
    useState<ConversationListItem | null>(null);

  const [messageText, setMessageText] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        setCurrentUserId(data.user?.id ?? "");
      });
    });
  }, []);

  const conversationsQuery = useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: getMyConversations,
  });

  const conversations = conversationsQuery.data ?? [];

  const selectedId = selectedConversation?.id ?? "";

  const messagesQuery = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: () => getConversationMessages(selectedId),
    enabled: Boolean(selectedId),
  });

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    if (!selectedId) return;

    const unsubscribe = subscribeToMessages(selectedId, (newMessage) => {
      queryClient.setQueryData<Message[]>(
        ["messages", selectedId],
        (oldMessages = []) => {
          if (oldMessages.some((message) => message.id === newMessage.id)) {
            return oldMessages;
          }

          return [...oldMessages, newMessage];
        }
      );

      queryClient.invalidateQueries({
        queryKey: ["messages", "conversations"],
      });
    });

    return unsubscribe;
  }, [selectedId, queryClient]);

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

  function handleSendMessage(event: React.FormEvent) {
    event.preventDefault();

    const content = messageText.trim();

    if (!content || !selectedId || sendMutation.isPending) return;

    sendMutation.mutate(content);
  }

  function openConversation(conversation: ConversationListItem) {
    setSelectedConversation(conversation);
  }

  function getConversationName(conversation: ConversationListItem) {
    if (conversation.kind === "group") {
      return conversation.title || "Group conversation";
    }

    const otherMember = getOtherMember(conversation, currentUserId);

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

    const otherMember = getOtherMember(conversation, currentUserId);

    return otherMember?.profile?.avatar_url;
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

  return (
    <div className="mx-auto flex h-[calc(100dvh-90px)] max-w-7xl flex-col p-3 md:h-[calc(100dvh-40px)] md:p-6">
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

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-[#110d12] md:grid-cols-[320px_1fr]">
        {/* CONVERSATION LIST */}

        <aside
          className={`${
            selectedConversation ? "hidden md:flex" : "flex"
          } min-h-0 flex-col border-r border-white/10`}
        >
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h2 className="font-semibold text-white">
              Your conversations
            </h2>

            <button
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

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isLoading && (
              <div className="p-6 text-center text-sm text-gray-400">
                Loading conversations...
              </div>
            )}

            {conversationsQuery.isError && (
              <div className="p-5 text-center">
                <p className="text-sm text-red-400">
                  Could not load conversations.
                </p>

                <button
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
                    Your conversations will appear here when you start
                    chatting.
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
                  onClick={() => openConversation(conversation)}
                  className={`flex w-full items-center gap-3 border-b border-white/5 p-4 text-left transition ${
                    active
                      ? "bg-pink-500/10"
                      : "hover:bg-white/5"
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-white">
                        {name}
                      </p>

                      {conversation.kind === "group" && (
                        <span className="text-xs text-pink-400">
                          Group
                        </span>
                      )}
                    </div>

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
                Select a conversation to view messages and continue
                chatting.
              </p>
            </div>
          ) : (
            <>
              {/* CHAT HEADER */}

              <div className="flex items-center gap-3 border-b border-white/10 p-4">
                <button
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
                    <p className="text-sm text-red-400">
                      Could not load messages.
                    </p>

                    <button
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

                {messages.map((message: Message) => {
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
                            Attachment: {message.media_name || message.message_type}
                          </p>
                        )}

                        <p className="mt-1 text-right text-[10px] opacity-60">
                          {new Date(
                            message.created_at
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
                  <p className="mb-2 px-2 text-xs text-red-400">
                    {sendMutation.error instanceof Error
                      ? sendMutation.error.message
                      : "Message could not be sent. Please try again."}
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
                    <Send size={18} />
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
