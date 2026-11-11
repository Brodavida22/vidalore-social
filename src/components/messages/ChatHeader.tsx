import { useMemo } from "react";
import { ArrowLeft, Users, MoreVertical, MessageCircle } from "lucide-react";
import type { ConversationListItem } from "@/services/messages";

export function ChatHeader({
  conversation,
  currentUserId,
  isOnline,
  typingUsers,
  onBack,
  onOpenDetails,
}: {
  conversation: ConversationListItem;
  currentUserId: string;
  isOnline: boolean;
  typingUsers: string[];
  onBack: () => void;
  onOpenDetails: () => void;
}) {
  const isGroup = conversation.kind === "group";

  // Compute other member name for direct chats
  const otherMember = conversation.members.find((m) => m.user_id !== currentUserId);
  const title = isGroup
    ? conversation.title || "Group conversation"
    : otherMember?.profile?.display_name || otherMember?.profile?.username || "Conversation";

  const avatar = isGroup ? conversation.image_url : otherMember?.profile?.avatar_url;

  // Format typing text
  const typingText = useMemo(() => {
    if (typingUsers.length === 0) return null;
    if (!isGroup) {
      return `${typingUsers[0] || "User"} is typing...`;
    }
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    }
    return `${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers.length - 2} others are typing...`;
  }, [typingUsers, isGroup]);

  return (
    <div className="flex items-center justify-between border-b border-border p-3 sm:px-4 bg-card select-none">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back button for mobile */}
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
          aria-label="Back to conversations list"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Conversation Avatar with Online Indicator */}
        <div
          className="relative shrink-0 cursor-pointer"
          onClick={isGroup ? onOpenDetails : undefined}
        >
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground ring-1 ring-border">
              {isGroup ? (
                <Users size={18} className="text-[#E91E63]" />
              ) : (
                <MessageCircle size={18} />
              )}
            </div>
          )}

          {/* Online badge for direct conversations */}
          {!isGroup && isOnline && (
            <span
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#22C55E] ring-2 ring-card"
              title="Online"
            />
          )}
        </div>

        {/* Title and Status */}
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={isGroup ? onOpenDetails : undefined}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
            {isGroup && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[#E91E63]/10 text-[#E91E63]">
                Group
              </span>
            )}
          </div>

          <div className="text-[11px] truncate">
            {typingText ? (
              <span className="text-[#E91E63] font-medium animate-pulse">{typingText}</span>
            ) : isGroup ? (
              <span className="text-muted-foreground">
                {conversation.members.length} members · tap for info
              </span>
            ) : isOnline ? (
              <span className="text-[#22C55E] font-medium">Online</span>
            ) : (
              <span className="text-muted-foreground">Direct message</span>
            )}
          </div>
        </div>
      </div>

      {/* Group Details action button */}
      {isGroup && (
        <button
          type="button"
          onClick={onOpenDetails}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          title="Group info & members"
        >
          <MoreVertical size={18} />
        </button>
      )}
    </div>
  );
}
