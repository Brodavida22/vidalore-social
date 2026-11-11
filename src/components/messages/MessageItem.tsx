import { useState, useRef } from "react";
import {
  Check,
  CheckCheck,
  Reply,
  Edit2,
  Trash2,
  MoreVertical,
  CornerDownRight,
  Sparkles,
} from "lucide-react";
import type { MessageWithReadsAndReactions } from "@/services/messages";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { MessageMediaRenderer } from "./MessageMediaRenderer";
import { ReactionPicker } from "./ReactionPicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function MessageItem({
  message,
  currentUserId,
  isGroup,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onLocateMessage,
}: {
  message: MessageWithReadsAndReactions;
  currentUserId: string;
  isGroup: boolean;
  isAdmin: boolean;
  onReply: (message: MessageWithReadsAndReactions) => void;
  onEdit: (message: MessageWithReadsAndReactions) => void;
  onDelete: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onLocateMessage?: (messageId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const isMine = message.sender_id === currentUserId;
  const isDeleted = Boolean(message.deleted_at);

  const isReadByRecipient = (message.reads ?? []).some((r) => r.user_id !== currentUserId);

  // Touch gesture handlers for mobile swipe-to-reply
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDeleted) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isHorizontalSwipeRef.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isDeleted) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Check if intentional horizontal swipe vs normal vertical scroll
    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(dx) > 7 || Math.abs(dy) > 7) {
        isHorizontalSwipeRef.current = Math.abs(dx) > Math.abs(dy) * 1.3 && dx > 0;
      }
    }

    if (isHorizontalSwipeRef.current) {
      const clampedOffset = Math.min(65, Math.max(0, dx * 0.75));
      setSwipeOffset(clampedOffset);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset >= 42 && !isDeleted) {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(20);
        } catch {
          // Ignore
        }
      }
      onReply(message);
    }
    setIsSwiping(false);
    setSwipeOffset(0);
    touchStartRef.current = null;
    isHorizontalSwipeRef.current = null;
  };

  // Group reactions by emoji
  const reactionsMap = new Map<
    string,
    { emoji: string; count: number; reactedByMe: boolean; users: string[] }
  >();

  for (const reaction of message.reactions ?? []) {
    const existing = reactionsMap.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      reactedByMe: false,
      users: [],
    };
    existing.count += 1;
    if (reaction.user_id === currentUserId) {
      existing.reactedByMe = true;
    }
    const name = reaction.profile?.display_name || reaction.profile?.username || "Someone";
    existing.users.push(name);
    reactionsMap.set(reaction.emoji, existing);
  }

  const reactionList = Array.from(reactionsMap.values());

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative flex gap-2.5 transition-colors duration-500 rounded-xl px-2 py-1 select-none overflow-hidden ${
        isMine ? "justify-end" : "justify-start"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Swipe to reply reveal icon */}
      {swipeOffset > 4 && (
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity pointer-events-none z-0"
          style={{ opacity: Math.min(1, swipeOffset / 35) }}
        >
          <div
            className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${
              swipeOffset >= 42
                ? "bg-[#E91E63] text-white scale-110 shadow-sm"
                : "bg-secondary text-muted-foreground scale-95"
            }`}
          >
            <Reply size={14} />
          </div>
        </div>
      )}

      {/* SENDER AVATAR IN GROUP CHAT (for non-self) */}
      {!isMine && isGroup && (
        <div className="shrink-0 mt-1">
          {message.sender ? (
            <UserAvatar profile={message.sender} className="h-7 w-7 ring-1 ring-border" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-secondary text-[11px] font-bold flex items-center justify-center">
              ?
            </div>
          )}
        </div>
      )}

      <div
        className={`relative max-w-[85%] sm:max-w-[75%] flex flex-col z-10 ${isMine ? "items-end" : "items-start"}`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? "none" : "transform 0.2s cubic-bezier(0.2, 0, 0, 1)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* SENDER NAME IN GROUP */}
        {!isMine && isGroup && (
          <span className="text-[11px] font-semibold text-muted-foreground ml-1 mb-0.5">
            {message.sender?.display_name || message.sender?.username || "Member"}
          </span>
        )}

        {/* QUOTED REPLY PREVIEW */}
        {message.replyToMessage && (
          <button
            type="button"
            onClick={() => onLocateMessage?.(message.replyToMessage!.id)}
            className={`mb-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-left text-xs transition border cursor-pointer max-w-full truncate ${
              isMine
                ? "bg-[#C2185B]/40 border-white/20 text-white/90 hover:bg-[#C2185B]/60"
                : "bg-secondary/90 border-border text-foreground hover:bg-secondary"
            }`}
          >
            <CornerDownRight size={12} className="shrink-0 opacity-70" />
            <span className="truncate text-[11px]">
              {message.replyToMessage.deleted_at
                ? "Quoted message was deleted"
                : message.replyToMessage.content || `[${message.replyToMessage.message_type}]`}
            </span>
          </button>
        )}

        {/* MAIN BUBBLE */}
        <div
          className={`relative rounded-2xl px-3.5 py-2.5 shadow-sm transition-all ${
            isMine
              ? "rounded-br-xs bg-[#E91E63] text-white"
              : "rounded-bl-xs border border-border bg-card text-foreground"
          }`}
        >
          {isDeleted ? (
            <p className="text-xs italic opacity-70 flex items-center gap-1.5">
              <span>This message was deleted</span>
            </p>
          ) : (
            <>
              {/* Media rendering (Image, Video, Voice note) */}
              {message.media_url && (
                <MessageMediaRenderer
                  messageType={message.message_type}
                  mediaUrl={message.media_url}
                  mediaName={message.media_name}
                  isMine={isMine}
                />
              )}

              {/* Text content */}
              {message.content && (
                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed mt-0.5 select-text">
                  {message.content}
                </p>
              )}
            </>
          )}

          {/* METADATA: Timestamp, Edited label & Read receipts */}
          <div
            className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] select-none ${
              isMine ? "text-white/80" : "text-muted-foreground"
            }`}
          >
            <span>
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            {message.edited_at && !isDeleted && <span className="italic opacity-80">· Edited</span>}

            {/* Read receipt checkmarks */}
            {isMine && !isDeleted && (
              <span
                className="inline-flex items-center ml-0.5"
                title={isReadByRecipient ? "Read by recipient" : "Delivered"}
              >
                {isReadByRecipient ? (
                  <CheckCheck size={13} className="text-white drop-shadow-xs" />
                ) : (
                  <Check size={13} className="text-white/60" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* EMOJI REACTIONS BAR */}
        {reactionList.length > 0 && !isDeleted && (
          <TooltipProvider>
            <div className="flex flex-wrap items-center gap-1 mt-1 -mb-1 px-1">
              {reactionList.map((rx) => (
                <Tooltip key={rx.emoji}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onToggleReaction(message.id, rx.emoji)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border shadow-xs transition ${
                        rx.reactedByMe
                          ? "bg-[#E91E63]/15 border-[#E91E63] text-[#E91E63]"
                          : "bg-card border-border hover:bg-secondary text-foreground"
                      }`}
                    >
                      <span>{rx.emoji}</span>
                      <span>{rx.count}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p>{rx.users.join(", ")}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* FLOATING ACTION TOOLBAR ON HOVER / TOUCH */}
      {!isDeleted && (
        <div
          className={`absolute top-0 -translate-y-1/2 flex items-center gap-0.5 p-1 rounded-full bg-card border border-border shadow-md z-10 transition-opacity ${
            isMine ? "right-6" : "left-12"
          } ${isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto"}`}
        >
          {/* Reaction picker */}
          <ReactionPicker onSelectEmoji={(emoji) => onToggleReaction(message.id, emoji)} />

          {/* Reply */}
          <button
            type="button"
            onClick={() => onReply(message)}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            title="Reply"
          >
            <Reply size={14} />
          </button>

          {/* Actions Dropdown: Edit & Delete */}
          {(isMine || isAdmin) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                  title="More actions"
                >
                  <MoreVertical size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isMine ? "end" : "start"} className="w-36 text-xs">
                {isMine && message.message_type === "text" && (
                  <DropdownMenuItem
                    onClick={() => onEdit(message)}
                    className="gap-2 cursor-pointer"
                  >
                    <Edit2 size={13} />
                    <span>Edit message</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onDelete(message.id)}
                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Delete message</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}
