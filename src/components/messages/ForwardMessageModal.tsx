import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, Send, Users, MessageCircle, Check, Loader2, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConversationListItem, MessageWithReadsAndReactions } from "@/services/messages";

interface ForwardMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: MessageWithReadsAndReactions | null;
  conversations: ConversationListItem[];
  currentUserId: string;
  onForward: (targetConversationId: string) => Promise<void>;
}

export function ForwardMessageModal({
  open,
  onOpenChange,
  message,
  conversations,
  currentUserId,
  onForward,
}: ForwardMessageModalProps) {
  const [search, setSearch] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState(false);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((c) => {
      if (c.kind === "group") {
        return (c.title || "").toLowerCase().includes(q);
      }
      const other = c.members.find((m) => m.user_id !== currentUserId);
      const name = (other?.profile?.display_name || other?.profile?.username || "").toLowerCase();
      return name.includes(q);
    });
  }, [conversations, search, currentUserId]);

  const handleSendForward = async () => {
    if (!selectedConvId) return;
    setForwarding(true);
    try {
      await onForward(selectedConvId);
      onOpenChange(false);
      setSelectedConvId(null);
      setSearch("");
    } finally {
      setForwarding(false);
    }
  };

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-border bg-card p-5 max-h-[85vh] flex flex-col rounded-2xl shadow-2xl">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="font-display text-lg text-foreground flex items-center gap-2">
            <CornerDownRight size={18} className="text-[#E91E63]" />
            Forward Message
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose a conversation or group to share this message with.
          </DialogDescription>
        </DialogHeader>

        {/* Message preview snippet */}
        <div className="rounded-xl bg-secondary/80 border border-border p-2.5 my-2 text-xs">
          <span className="text-[10px] uppercase font-bold text-[#E91E63] tracking-wide block mb-0.5">
            Forwarding {message.message_type.toUpperCase()}
          </span>
          <p className="text-foreground line-clamp-2 truncate">
            {message.content ||
              (message.media_name
                ? `Attachment: ${message.media_name}`
                : `[${message.message_type}]`)}
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats to forward to..."
            className="w-full rounded-xl border border-border bg-secondary/50 py-2 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-[#E91E63]"
          />
        </div>

        {/* List of conversations */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-[180px] max-h-[300px]">
          {filteredConversations.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No matching conversations found.
            </p>
          ) : (
            filteredConversations.map((conv) => {
              const isGroup = conv.kind === "group";
              const other = conv.members.find((m) => m.user_id !== currentUserId);
              const title = isGroup
                ? conv.title || "Group"
                : other?.profile?.display_name || other?.profile?.username || "Direct Chat";
              const avatar = isGroup ? conv.image_url : other?.profile?.avatar_url;
              const isSelected = selectedConvId === conv.id;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`flex w-full items-center justify-between gap-3 p-2.5 rounded-xl transition text-left ${
                    isSelected
                      ? "bg-[#E91E63]/15 border border-[#E91E63]/40"
                      : "hover:bg-secondary/70 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0 text-foreground">
                        {isGroup ? (
                          <Users size={16} className="text-[#E91E63]" />
                        ) : (
                          <MessageCircle size={16} />
                        )}
                      </div>
                    )}
                    <div className="min-w-0 truncate">
                      <p className="text-xs font-semibold text-foreground truncate">{title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {isGroup ? `${conv.members.length} members` : "Direct conversation"}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center transition ${
                        isSelected
                          ? "bg-[#E91E63] border-[#E91E63] text-white"
                          : "border-border bg-card"
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedConvId || forwarding}
            onClick={handleSendForward}
            className="rounded-xl text-xs h-9 bg-[#E91E63] hover:bg-[#C2185B] text-white font-semibold gap-1.5"
          >
            {forwarding ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Forward
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
