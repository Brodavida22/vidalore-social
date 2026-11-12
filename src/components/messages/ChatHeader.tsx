import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Users,
  MoreVertical,
  MessageCircle,
  Trash2,
  Eraser,
  LogOut,
  Info,
  AlertTriangle,
} from "lucide-react";
import type { ConversationListItem } from "@/services/messages";
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

export function ChatHeader({
  conversation,
  currentUserId,
  isOnline,
  typingUsers,
  isOwner,
  onBack,
  onOpenDetails,
  onClearChat,
  onDeleteConversation,
  onLeaveGroup,
  onDeleteGroup,
}: {
  conversation: ConversationListItem;
  currentUserId: string;
  isOnline: boolean;
  typingUsers: string[];
  isOwner?: boolean;
  onBack: () => void;
  onOpenDetails: () => void;
  onClearChat?: () => void;
  onDeleteConversation?: () => void;
  onLeaveGroup?: () => void;
  onDeleteGroup?: () => void;
}) {
  const isGroup = conversation.kind === "group";

  const [clearChatConfirmOpen, setClearChatConfirmOpen] = useState(false);
  const [deleteConvConfirmOpen, setDeleteConvConfirmOpen] = useState(false);
  const [deleteGroupConfirmOpen, setDeleteGroupConfirmOpen] = useState(false);

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
    <>
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

        {/* WhatsApp-Style Chat Management Menu for both Direct and Group chats */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                title="Chat options"
              >
                <MoreVertical size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-xs">
              {isGroup && (
                <DropdownMenuItem onClick={onOpenDetails} className="gap-2 cursor-pointer">
                  <Info size={14} className="text-muted-foreground" />
                  <span>Group info & members</span>
                </DropdownMenuItem>
              )}

              {onClearChat && (
                <DropdownMenuItem
                  onClick={() => setClearChatConfirmOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <Eraser size={14} className="text-muted-foreground" />
                  <span>Clear chat history</span>
                </DropdownMenuItem>
              )}

              {!isGroup && onDeleteConversation && (
                <DropdownMenuItem
                  onClick={() => setDeleteConvConfirmOpen(true)}
                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete conversation</span>
                </DropdownMenuItem>
              )}

              {isGroup && onLeaveGroup && (
                <DropdownMenuItem
                  onClick={onLeaveGroup}
                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Leave group</span>
                </DropdownMenuItem>
              )}

              {isGroup && isOwner && onDeleteGroup && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteGroupConfirmOpen(true)}
                    className="gap-2 text-destructive focus:text-destructive font-semibold cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Delete group for all</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Confirmation Dialog: Clear Chat */}
      <AlertDialog open={clearChatConfirmOpen} onOpenChange={setClearChatConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl bg-card border-border p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display text-base text-foreground">
              <Eraser size={18} className="text-[#E91E63]" />
              Clear chat history?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Messages in this chat will be cleared from your device. Other participants will still
              be able to view their message history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="text-xs rounded-xl h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onClearChat?.();
                setClearChatConfirmOpen(false);
              }}
              className="text-xs rounded-xl h-8 bg-[#E91E63] hover:bg-[#C2185B] text-white"
            >
              Clear Messages
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Delete Conversation (Direct) */}
      <AlertDialog open={deleteConvConfirmOpen} onOpenChange={setDeleteConvConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl bg-card border-border p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display text-base text-foreground">
              <Trash2 size={18} className="text-destructive" />
              Delete this conversation?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This conversation will be hidden from your chat list. The other user's chat history
              and account will not be affected. If a new message is received, the conversation will
              reappear.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="text-xs rounded-xl h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDeleteConversation?.();
                setDeleteConvConfirmOpen(false);
              }}
              className="text-xs rounded-xl h-8 bg-destructive hover:bg-destructive/90 text-white"
            >
              Delete Conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Delete Group for all (Owner only) */}
      <AlertDialog open={deleteGroupConfirmOpen} onOpenChange={setDeleteGroupConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl bg-card border-border p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display text-base text-foreground">
              <AlertTriangle size={18} className="text-destructive" />
              Delete group permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              As the group owner, this will delete the group, its message history, and remove all
              members. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="text-xs rounded-xl h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDeleteGroup?.();
                setDeleteGroupConfirmOpen(false);
              }}
              className="text-xs rounded-xl h-8 bg-destructive hover:bg-destructive/90 text-white font-semibold"
            >
              Delete Group For Everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
