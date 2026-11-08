import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, UserPlus, UserCheck, UserX, Search, Check, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { communityProfilesQuery, type Profile } from "@/services/profiles";
import {
  getStoredRelationships,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  toggleFollow,
  sendFriendRequest,
  type RelationshipState,
} from "@/services/social";

interface PersonInfo {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  points: number;
  bio?: string;
}

const SEED_PEOPLE: PersonInfo[] = [
  {
    id: "creator-celeste",
    name: "Celeste Moreau",
    username: "celeste",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80",
    points: 1420,
    bio: "Curator of night-blooming gardens and velvet shadows 🌹",
  },
  {
    id: "creator-raphael",
    name: "Raphaël Vance",
    username: "raphael",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
    points: 980,
    bio: "Visual director & architectural photography.",
  },
  {
    id: "creator-seraphina",
    name: "Seraphina Lin",
    username: "seraphina",
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80",
    points: 630,
    bio: "Acoustic strings & dark ambient audio.",
  },
  {
    id: "creator-adrian",
    name: "Adrian Thorne",
    username: "adrian",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80",
    points: 510,
    bio: "Noir literature & coffee connoisseur.",
  },
];

export function FriendsModal({
  open,
  onOpenChange,
  me,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me?: Profile | null;
}) {
  const [tab, setTab] = useState<"friends" | "requests" | "following" | "followers" | "suggested">(
    "friends",
  );
  const [search, setSearch] = useState("");
  const [rel, setRel] = useState<RelationshipState>(() => getStoredRelationships());

  const { data: dbProfiles } = useQuery(communityProfilesQuery(15));

  // Build a people dictionary combining database profiles with seed creators
  const peopleMap: Record<string, PersonInfo> = {};
  SEED_PEOPLE.forEach((p) => {
    peopleMap[p.id] = p;
  });
  if (dbProfiles) {
    dbProfiles.forEach((p) => {
      peopleMap[p.id] = {
        id: p.id,
        name: p.display_name || p.username,
        username: p.username,
        avatarUrl: p.avatar_url,
        points: p.points_balance,
        bio: p.bio ?? undefined,
      };
    });
  }

  const allPeople = Object.values(peopleMap).filter((p) => p.id !== me?.id);

  function handleAccept(id: string) {
    acceptFriendRequest(id);
    setRel(getStoredRelationships());
    toast.success("Friend request accepted! You are now connected in the garden 🌹");
  }

  function handleDecline(id: string) {
    declineFriendRequest(id);
    setRel(getStoredRelationships());
    toast.info("Request removed");
  }

  function handleRemoveFriend(id: string) {
    removeFriend(id);
    setRel(getStoredRelationships());
    toast.info("Removed from friends");
  }

  function handleToggleFollow(id: string) {
    const isNow = toggleFollow(id);
    setRel(getStoredRelationships());
    toast.info(isNow ? "Following in the Garden 🌹" : "Unfollowed");
  }

  function handleSendRequest(id: string) {
    sendFriendRequest(id);
    setRel(getStoredRelationships());
    toast.success("Friend request sent 🌹");
  }

  // Active list based on tab
  let currentList: PersonInfo[] = [];
  if (tab === "friends") {
    currentList = allPeople.filter((p) => rel.friends.includes(p.id));
  } else if (tab === "requests") {
    currentList = allPeople.filter((p) => rel.incomingFriendRequests.includes(p.id));
  } else if (tab === "following") {
    currentList = allPeople.filter((p) => rel.following.includes(p.id));
  } else if (tab === "followers") {
    currentList = allPeople.filter((p) => rel.followers.includes(p.id));
  } else if (tab === "suggested") {
    currentList = allPeople.filter(
      (p) => !rel.friends.includes(p.id) && !rel.incomingFriendRequests.includes(p.id),
    );
  }

  if (search.trim()) {
    currentList = currentList.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.username.toLowerCase().includes(search.toLowerCase()),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass border-border/80 p-5 max-h-[85vh] flex flex-col">
        <DialogHeader className="border-b border-border/60 pb-3">
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Garden Circle & Connections
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative pt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends & creators..."
            className="h-9 rounded-xl bg-secondary/50 pl-9 text-xs border-border/50"
          />
        </div>

        {/* Tab Selection */}
        <div className="flex gap-1.5 overflow-x-auto py-2">
          {(
            [
              { id: "friends", label: `Friends (${rel.friends.length})` },
              { id: "requests", label: `Requests (${rel.incomingFriendRequests.length})` },
              { id: "following", label: `Following (${rel.following.length})` },
              { id: "followers", label: `Followers (${rel.followers.length})` },
              { id: "suggested", label: "Suggested" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all shrink-0 ${
                tab === t.id
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* People List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 py-2 pr-1">
          {currentList.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <span className="text-3xl">🥀</span>
              <p className="font-semibold text-foreground">No one here yet</p>
              <p className="text-xs text-muted-foreground">
                {tab === "requests"
                  ? "No incoming friend requests right now."
                  : tab === "friends"
                    ? "Connect with suggested creators to grow your garden circle."
                    : "No members matched your search."}
              </p>
            </div>
          ) : (
            currentList.map((person) => {
              const isFriend = rel.friends.includes(person.id);
              const isFollowing = rel.following.includes(person.id);
              const hasSentReq = rel.outgoingFriendRequests.includes(person.id);

              return (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/40 p-3 hover:bg-secondary/60 transition-colors"
                >
                  <Link
                    to="/u/$username"
                    params={{ username: person.username }}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 min-w-0 group"
                  >
                    <UserAvatar
                      profile={{
                        avatar_url: person.avatarUrl ?? null,
                        username: person.username,
                        display_name: person.name,
                      }}
                      className="h-10 w-10 text-xs ring-1 ring-primary/30 group-hover:ring-primary transition-all shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground group-hover:text-rose-soft truncate">
                        {person.name}
                      </p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        @{person.username} · 🌹 {person.points} pts
                      </p>
                      {person.bio && (
                        <p className="text-[0.65rem] text-foreground/80 truncate mt-0.5">
                          {person.bio}
                        </p>
                      )}
                    </div>
                  </Link>

                  {/* Contextual Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {tab === "requests" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="rose"
                          onClick={() => handleAccept(person.id)}
                          className="h-7 px-2.5 rounded-full text-xs"
                        >
                          <Check className="h-3 w-3 mr-1" /> Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDecline(person.id)}
                          className="h-7 px-2 rounded-full text-xs text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant={isFollowing ? "glass" : "rose"}
                          onClick={() => handleToggleFollow(person.id)}
                          className="h-7 px-2.5 rounded-full text-[0.7rem] font-semibold"
                        >
                          {isFollowing ? (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" /> Following
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-3 w-3 mr-1" /> Follow
                            </>
                          )}
                        </Button>

                        {!isFriend && !hasSentReq && (
                          <Button
                            type="button"
                            size="sm"
                            variant="glass"
                            onClick={() => handleSendRequest(person.id)}
                            className="h-7 px-2.5 rounded-full text-[0.7rem]"
                            title="Add Friend"
                          >
                            + Friend
                          </Button>
                        )}

                        {hasSentReq && (
                          <span className="text-[0.65rem] text-rose-soft px-1">Pending</span>
                        )}

                        {isFriend && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFriend(person.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded-full text-xs"
                            title="Remove friend"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
