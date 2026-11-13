import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  CheckCheck,
  Reply,
  Edit2,
  Trash2,
  MoreVertical,
  CornerDownRight,
  Copy,
  Share2,
  Crown,
  ShieldCheck,
  Shield,
  Clock,
  AlertCircle,
  RotateCcw,
  X,
  Play,
  Sparkles,
} from "lucide-react";
import type { MessageWithReadsAndReactions } from "@/services/messages";
import {
  parseStoryReplyMessage,
  formatMessageTextForPreview,
  resolveStoryPreview,
  type StoryReplyReference,
} from "@/lib/storyReplyPayload";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { MessageMediaRenderer } from "./MessageMediaRenderer";
import { ReactionPicker } from "./ReactionPicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function StoryReplyCard({ storyRef, isMine }: { storyRef: StoryReplyReference; isMine: boolean }) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["story-preview", storyRef.storyId],
    queryFn: () => resolveStoryPreview(storyRef),
    staleTime: 60_000,
  });

  const isAvailable = Boolean(preview?.available && preview.mediaUrl);
  const statusLabel =
    preview?.reason === "expired"
      ? "Story expired"
      : preview?.reason === "deleted"
        ? "Story removed"
        : "Story unavailable";

  return (
    <>
      <button
        type="button"
        disabled={!isAvailable}
        onClick={(e) => {
          e.stopPropagation();
          if (isAvailable) setViewerOpen(true);
        }}
        className={`mb-1.5 flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition ${
          isMine
            ? "bg-black/20 border-white/20 text-white hover:bg-black/30 disabled:hover:bg-black/20"
            : "bg-secondary/70 border-border text-foreground hover:bg-secondary disabled:hover:bg-secondary/70"
        } ${isAvailable ? "cursor-pointer" : "cursor-default opacity-80"}`}
      >
        <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-black/50 flex items-center justify-center border border-white/10">
          {isLoading ? (
            <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : isAvailable && preview?.mediaUrl ? (
            preview.mediaType === "video" ? (
              <>
                <video
                  src={preview.mediaUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-3.5 w-3.5 text-white fill-current" />
                </span>
              </>
            ) : (
              <img
                src={preview.mediaUrl}
                alt={`@${storyRef.ownerUsername}'s story`}
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <Sparkles className="h-3.5 w-3.5 opacity-60" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isMine ? "text-white/80" : "text-[#E91E63]"
            }`}
          >
            Replied to @{storyRef.ownerUsername}&apos;s story
          </p>
          <p
            className={`text-[11px] truncate ${isMine ? "text-white/90" : "text-muted-foreground"}`}
          >
            {isLoading
              ? "Loading story..."
              : isAvailable
                ? preview?.caption ||
                  (preview?.mediaType === "video" ? "Tap to view video story" : "Tap to view story")
                : statusLabel}
          </p>
        </div>
      </button>

      {isAvailable && preview?.mediaUrl && (
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent className="sm:max-w-sm bg-black border border-white/15 p-0 overflow-hidden rounded-2xl">
            <DialogHeader className="p-3 border-b border-white/10">
              <DialogTitle className="text-xs font-semibold text-white">
                @{storyRef.ownerUsername}&apos;s story
              </DialogTitle>
            </DialogHeader>
            <div className="relative bg-black flex items-center justify-center max-h-[75vh]">
              {preview.mediaType === "video" ? (
                <video
                  src={preview.mediaUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <img
                  src={preview.mediaUrl}
                  alt={`@${storyRef.ownerUsername}'s story`}
                  className="max-h-[70vh] w-full object-contain"
                />
              )}
            </div>
            {preview.caption && (
              <p className="p-3 text-xs text-white/90 bg-black/80 border-t border-white/10">
                {preview.caption}
              </p>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function MessageItem({
  message,
  currentUserId,
  isGroup,
  isAdmin,
  senderRole,
  peerLastReadAt,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onToggleReaction,
  onLocateMessage,
  onRetry,
  onDismissFailed,
}: {
  message: MessageWithReadsAndReactions;
  currentUserId: string;
  isGroup: boolean;
  isAdmin: boolean;
  senderRole?: "owner" | "admin" | "moderator" | "member";
  peerLastReadAt?: string | null | undefined;
  onReply: (message: MessageWithReadsAndReactions) => void;
  onEdit: (message: MessageWithReadsAndReactions) => void;
  onDelete: (message: MessageWithReadsAndReactions) => void;
  onForward?: (message: MessageWithReadsAndReactions) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onLocateMessage?: (messageId: string) => void;
  onRetry?: (message: MessageWithReadsAndReactions) => void;
  onDismissFailed?: (messageId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const isMine = message.sender_id === currentUserId;
  const isDeleted = Boolean(message.deleted_at);
  const isSendingLocal = message.localStatus === "sending";
  const isFailedLocal = message.localStatus === "failed";
  const isPendingOrFailed = isSendingLocal || isFailedLocal;
  const isReadByRecipient =
    !isPendingOrFailed &&
    Boolean(
      (message.reads ?? []).some((r) => r.user_id !== currentUserId) ||
      (!isGroup && peerLastReadAt && Date.parse(peerLastReadAt) >= Date.parse(message.created_at)),
    );

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Long press & Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDeleted || isPendingOrFailed) return;
    const touch = e.touches[0];
    if (!touch) return;

    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isHorizontalSwipeRef.current = null;
    isLongPressRef.current = false;

    // Start 450ms long-press timer
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(25);
        } catch {
          // Ignore
        }
      }
      setMenuOpen(true);
      setSwipeOffset(0);
      setIsSwiping(false);
    }, 450);

    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isDeleted || isPendingOrFailed) return;
    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // If moved more than 8px, cancel long-press
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    if (isLongPressRef.current) return;

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
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isLongPressRef.current) {
      setIsSwiping(false);
      setSwipeOffset(0);
      return;
    }

    if (swipeOffset >= 42 && !isDeleted && !isPendingOrFailed) {
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

  const parsedStoryReply = parseStoryReplyMessage(message.content);

  // Right-click context menu handler for desktop
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isDeleted || isPendingOrFailed) return;
    e.preventDefault();
    setMenuOpen(true);
  };

  const handleCopy = () => {
    if (!message.content) return;
    const textToCopy = parsedStoryReply ? parsedStoryReply.replyText : message.content;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    toast.success("Message copied to clipboard.");
    setMenuOpen(false);
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
      onContextMenu={handleContextMenu}
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
        className={`relative max-w-[85%] sm:max-w-[75%] flex flex-col z-10 select-none ${isMine ? "items-end" : "items-start"}`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? "none" : "transform 0.2s cubic-bezier(0.2, 0, 1)",
          touchAction: "pan-y",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={handleContextMenu}
      >
        {/* SENDER NAME & ROLE BADGE IN GROUP */}
        {!isMine && isGroup && (
          <div className="flex items-center gap-1.5 ml-1 mb-0.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {message.sender?.display_name || message.sender?.username || "Member"}
            </span>
            {senderRole === "owner" && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-500">
                <Crown size={9} />
                Owner
              </span>
            )}
            {senderRole === "admin" && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-[#E91E63]/20 text-[#E91E63]">
                <ShieldCheck size={9} />
                Admin
              </span>
            )}
            {senderRole === "moderator" && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-500">
                <Shield size={9} />
                Mod
              </span>
            )}
          </div>
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
                : message.replyToMessage.content
                  ? formatMessageTextForPreview(message.replyToMessage.content)
                  : `[${message.replyToMessage.message_type}]`}
            </span>
          </button>
        )}

        {/* MAIN BUBBLE */}
        <div
          className={`relative rounded-2xl px-3.5 py-2.5 shadow-sm transition-all cursor-pointer ${
            isMine
              ? "rounded-br-xs bg-[#E91E63] text-white"
              : "rounded-bl-xs border border-border bg-card text-foreground"
          }`}
          onClick={() => {
            // Optional: short click on mobile can open action menu if desired
          }}
        >
          {isDeleted ? (
            <p className="text-xs italic opacity-70 flex items-center gap-1.5 select-none">
              <span>This message was deleted</span>
            </p>
          ) : (
            <>
              {/* Story Reply Reference Card (if this message was sent from a Story) */}
              {parsedStoryReply && (
                <StoryReplyCard storyRef={parsedStoryReply.storyRef} isMine={isMine} />
              )}

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
              {parsedStoryReply ? (
                parsedStoryReply.replyText ? (
                  <p className="whitespace-pre-wrap break-words text-xs leading-relaxed mt-0.5 select-text">
                    {parsedStoryReply.replyText}
                  </p>
                ) : null
              ) : (
                message.content && (
                  <p className="whitespace-pre-wrap break-words text-xs leading-relaxed mt-0.5 select-text">
                    {message.content}
                  </p>
                )
              )}
            </>
          )}

          {/* METADATA: Timestamp, Edited label & Delivery / Read receipts */}
          <div
            className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] select-none ${
              isMine ? "text-white/85" : "text-muted-foreground"
            }`}
          >
            <span>
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            {message.edited_at && !isDeleted && <span className="italic opacity-80">· Edited</span>}

            {/* Delivery status & read receipt */}
            {isMine && !isDeleted && (
              <span className="inline-flex items-center gap-1 ml-0.5">
                {isSendingLocal ? (
                  <span className="inline-flex items-center gap-1 text-white/80">
                    <Clock size={11} className="animate-pulse" />
                    <span>Sending...</span>
                  </span>
                ) : isFailedLocal ? (
                  <span
                    className="inline-flex items-center gap-1 rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-medium text-amber-200"
                    title={message.localError || "Failed to send"}
                  >
                    <AlertCircle size={11} />
                    <span>Failed to send</span>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(message);
                        }}
                        className="ml-1 inline-flex items-center gap-0.5 underline font-semibold text-white hover:text-amber-100"
                      >
                        <RotateCcw size={10} />
                        Retry
                      </button>
                    )}
                    {onDismissFailed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismissFailed(message.id);
                        }}
                        aria-label="Dismiss failed message"
                        className="ml-0.5 text-white/70 hover:text-white"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ) : isReadByRecipient ? (
                  <span className="inline-flex items-center gap-0.5" title="Seen">
                    <CheckCheck size={13} className="text-sky-200 drop-shadow-xs" />
                    <span>Seen</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-white/75" title="Sent">
                    <Check size={13} />
                    <span>Sent</span>
                  </span>
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

      {/* FLOATING ACTION TOOLBAR ON DESKTOP HOVER */}
      {!isDeleted && !isPendingOrFailed && (
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

          {/* Forward */}
          {onForward && (
            <button
              type="button"
              onClick={() => onForward(message)}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              title="Forward"
            >
              <Share2 size={14} />
            </button>
          )}

          {/* More actions trigger */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            title="More actions"
          >
            <MoreVertical size={14} />
          </button>
        </div>
      )}

      {/* WHATSAPP-STYLE ACTION MODAL / BOTTOM SHEET ON LONG-PRESS OR RIGHT-CLICK */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="sm:max-w-xs p-3 rounded-2xl bg-card border-border shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Message Actions</DialogTitle>
          </DialogHeader>

          {/* Quick Reaction Bar on top */}
          <div className="flex items-center justify-between gap-1 p-2 bg-secondary/60 rounded-xl mb-2">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggleReaction(message.id, emoji);
                  setMenuOpen(false);
                }}
                className="text-xl p-1.5 hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
            <div className="border-l border-border pl-1">
              <ReactionPicker
                onSelectEmoji={(emoji) => {
                  onToggleReaction(message.id, emoji);
                  setMenuOpen(false);
                }}
              />
            </div>
          </div>

          {/* Action List Items */}
          <div className="flex flex-col gap-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onReply(message);
              }}
              className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-secondary text-foreground text-left transition"
            >
              <Reply size={15} className="text-muted-foreground" />
              <span>Reply</span>
            </button>

            {message.content && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-secondary text-foreground text-left transition"
              >
                <Copy size={15} className="text-muted-foreground" />
                <span>Copy message</span>
              </button>
            )}

            {onForward && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onForward(message);
                }}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-secondary text-foreground text-left transition"
              >
                <Share2 size={15} className="text-muted-foreground" />
                <span>Forward message</span>
              </button>
            )}

            {isMine && message.message_type === "text" && !isDeleted && !parsedStoryReply && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(message);
                }}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-secondary text-foreground text-left transition"
              >
                <Edit2 size={15} className="text-muted-foreground" />
                <span>Edit message</span>
              </button>
            )}

            {/* Delete option */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete(message);
              }}
              className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-destructive/10 text-destructive text-left transition"
            >
              <Trash2 size={15} />
              <span>Delete message</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
