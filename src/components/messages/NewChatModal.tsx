import { useState, useEffect } from "react";
import { Search, Loader2, Sparkles, X, MessageSquarePlus } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  useOnlinePresence,
  seedProfileLastSeen,
  extractProfileLastSeen,
  getEffectiveLastSeen,
} from "@/lib/onlinePresence";
import { PresenceDot, PresenceStatusText } from "@/components/social/PresenceIndicator";
import {
  searchProfiles,
  getOrCreateDirectConversation,
  type ConversationListItem,
  type Profile,
} from "@/services/messages";

export function NewChatModal({
  open,
  onOpenChange,
  currentUserId,
  onConversationSelected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onConversationSelected: (conversation: ConversationListItem) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingWithUserId, setCreatingWithUserId] = useState<string | null>(null);
  const { isOnline, nowMs } = useOnlinePresence();

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setCreatingWithUserId(null);
      return;
    }

    let active = true;
    setLoading(true);

    const timer = setTimeout(
      () => {
        searchProfiles(search, currentUserId)
          .then((data) => {
            if (active) {
              seedProfileLastSeen(data);
              setResults(data);
              setLoading(false);
            }
          })
          .catch((err) => {
            console.error("Failed to load profiles:", err);
            if (active) setLoading(false);
          });
      },
      search.trim() ? 250 : 0,
    );

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, search, currentUserId]);

  async function handleSelectUser(user: Profile) {
    if (creatingWithUserId) return;

    try {
      setCreatingWithUserId(user.id);
      const conversation = await getOrCreateDirectConversation(user.id);
      toast.success(`Chat with ${user.display_name || user.username} opened 🌹`);
      onConversationSelected(conversation);
      onOpenChange(false);
    } catch (err) {
      console.error("Error creating direct chat:", err);
      toast.error(
        err instanceof Error ? err.message : "Could not open conversation. Please try again.",
      );
    } finally {
      setCreatingWithUserId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card p-5 max-h-[85vh] sm:max-w-md flex flex-col rounded-2xl shadow-xl">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="font-display text-xl flex items-center gap-2 text-foreground">
            <MessageSquarePlus className="h-5 w-5 text-[#E91E63]" />
            New Message
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Start a direct conversation with members.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative pt-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or @username..."
            className="h-10 rounded-xl bg-secondary/60 pl-10 pr-9 text-xs border-border focus-visible:ring-[#E91E63]"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1 min-h-[220px]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-[#E91E63]" />
              <p className="text-xs">Finding members...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="font-semibold text-sm text-foreground">No members found</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {search.trim()
                  ? `No user matched "${search}". Try searching by username.`
                  : "No community members found to start a chat."}
              </p>
            </div>
          ) : (
            <>
              {!search.trim() && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground font-semibold">
                  <Sparkles className="h-3 w-3 text-[#E91E63]" />
                  Suggested Members
                </div>
              )}
              {results.map((profile) => {
                const isCreating = creatingWithUserId === profile.id;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={Boolean(creatingWithUserId)}
                    onClick={() => handleSelectUser(profile)}
                    className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-secondary transition-all text-left group border border-transparent hover:border-border disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <UserAvatar
                          profile={profile}
                          className="h-10 w-10 shrink-0 ring-1 ring-border group-hover:ring-[#E91E63] transition-all"
                        />
                        <PresenceDot
                          isOnline={isOnline(profile.id)}
                          lastSeenAt={getEffectiveLastSeen(
                            profile.id,
                            extractProfileLastSeen(profile),
                          )}
                          size="sm"
                          className="absolute bottom-0 right-0"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-foreground group-hover:text-[#E91E63] transition-colors truncate">
                            {profile.display_name || profile.username}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <p className="text-[0.7rem] text-muted-foreground truncate">
                            @{profile.username}
                          </p>
                          <PresenceStatusText
                            isOnline={isOnline(profile.id)}
                            lastSeenAt={getEffectiveLastSeen(
                              profile.id,
                              extractProfileLastSeen(profile),
                            )}
                            nowMs={nowMs}
                            className="text-[10px]"
                          />
                        </div>
                        {profile.bio && (
                          <p className="text-[0.68rem] text-muted-foreground truncate mt-0.5">
                            {profile.bio}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isCreating ? (
                        <span className="flex items-center gap-1.5 text-xs text-[#E91E63] font-medium">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Opening...
                        </span>
                      ) : (
                        <span className="rounded-lg bg-[#E91E63] text-white px-3 py-1 text-xs font-medium hover:bg-[#C2185B] transition-all shadow-sm">
                          Chat
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
