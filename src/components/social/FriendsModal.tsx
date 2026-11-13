import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, UserCheck, Search, Check, X, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  useOnlinePresence,
  seedProfileLastSeen,
  extractProfileLastSeen,
  getEffectiveLastSeen,
} from "@/lib/onlinePresence";
import { PresenceDot, PresenceStatusText } from "@/components/social/PresenceIndicator";

import { communityProfilesQuery, type Profile } from "@/services/profiles";

import {
  getFriends,
  getFollowers,
  getFollowing,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  followUser,
  unfollowUser,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
} from "@/services/relationships";

type Tab = "friends" | "requests" | "following" | "followers" | "suggested";

interface PersonInfo {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null | undefined;
  points: number;
  bio?: string | null | undefined;
  lastSeenAt?: string | null | undefined;
  requestId?: string | undefined;
}

export function FriendsModal({
  open,
  onOpenChange,
  me,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me?: Profile | null | undefined;
}) {
  const [tab, setTab] = useState<Tab>("friends");
  const [search, setSearch] = useState("");

  const queryClient = useQueryClient();
  const { isOnline, nowMs } = useOnlinePresence();

  const refreshRelationships = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["friends"] }),
      queryClient.invalidateQueries({ queryKey: ["followers"] }),
      queryClient.invalidateQueries({ queryKey: ["following"] }),
      queryClient.invalidateQueries({ queryKey: ["incoming-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["outgoing-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["community-profiles"] }),
    ]);
  };

  const { data: dbProfiles = [], isLoading: profilesLoading } = useQuery({
    ...communityProfilesQuery(50),
    enabled: open,
  });

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
    enabled: open,
  });

  const { data: following = [], isLoading: followingLoading } = useQuery({
    queryKey: ["following", me?.id],
    queryFn: () => getFollowing(me!.id),
    enabled: open && !!me?.id,
  });

  const { data: followers = [], isLoading: followersLoading } = useQuery({
    queryKey: ["followers", me?.id],
    queryFn: () => getFollowers(me!.id),
    enabled: open && !!me?.id,
  });

  const { data: incomingRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["incoming-requests"],
    queryFn: getIncomingFriendRequests,
    enabled: open,
  });

  const { data: outgoingRequests = [] } = useQuery({
    queryKey: ["outgoing-requests"],
    queryFn: getOutgoingFriendRequests,
    enabled: open,
  });

  useEffect(() => {
    const batch = [...dbProfiles, ...friends, ...following, ...followers];
    if (batch.length > 0) {
      seedProfileLastSeen(batch);
    }
  }, [dbProfiles, friends, following, followers]);

  const people = useMemo<PersonInfo[]>(
    () =>
      dbProfiles
        .filter((profile) => profile.id !== me?.id)
        .map((profile) => ({
          id: profile.id,
          name: profile.display_name || profile.username,
          username: profile.username,
          avatarUrl: profile.avatar_url,
          points: profile.points_balance,
          bio: profile.bio,
          lastSeenAt: extractProfileLastSeen(profile),
        })),
    [dbProfiles, me?.id],
  );

  const toPeople = (profiles: Profile[]): PersonInfo[] =>
    profiles.map((profile) => ({
      id: profile.id,
      name: profile.display_name || profile.username,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      points: profile.points_balance,
      bio: profile.bio,
      lastSeenAt: extractProfileLastSeen(profile),
    }));

  const friendIds = friends.map((person) => person.id);
  const followingIds = following.map((person) => person.id);
  const followerIds = followers.map((person) => person.id);

  const outgoingIds = outgoingRequests.map((request) => request.recipient_id);

  const currentList: PersonInfo[] = useMemo(() => {
    let list: PersonInfo[] = [];

    switch (tab) {
      case "friends":
        list = toPeople(friends);
        break;

      case "following":
        list = toPeople(following);
        break;

      case "followers":
        list = toPeople(followers);
        break;

      case "requests":
        list = incomingRequests
          .filter((request) => request.profile)
          .map((request) => ({
            id: request.requester_id,
            name: request.profile!.display_name || request.profile!.username,
            username: request.profile!.username,
            avatarUrl: request.profile!.avatar_url,
            points: request.profile!.points_balance,
            bio: request.profile!.bio,
            requestId: request.id,
          }));
        break;

      case "suggested":
        list = people.filter(
          (person) =>
            !friendIds.includes(person.id) &&
            !followingIds.includes(person.id) &&
            !outgoingIds.includes(person.id),
        );
        break;
    }

    if (search.trim()) {
      const term = search.toLowerCase();

      list = list.filter(
        (person) =>
          person.name.toLowerCase().includes(term) || person.username.toLowerCase().includes(term),
      );
    }

    return list;
  }, [
    tab,
    friends,
    following,
    followers,
    incomingRequests,
    people,
    search,
    friendIds.join(","),
    followingIds.join(","),
    outgoingIds.join(","),
  ]);

  const [busyId, setBusyId] = useState<string | null>(null);

  async function runAction(id: string, action: () => Promise<unknown>, successMessage: string) {
    try {
      setBusyId(id);
      await action();
      await refreshRelationships();
      toast.success(successMessage);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function handleFollow(person: PersonInfo) {
    const isNowFollowing = followingIds.includes(person.id);

    return runAction(
      person.id,
      () => (isNowFollowing ? unfollowUser(person.id) : followUser(person.id)),
      isNowFollowing ? "Unfollowed successfully." : "Following in the Garden 🌹",
    );
  }

  function handleFriendRequest(person: PersonInfo) {
    return runAction(person.id, () => sendFriendRequest(person.id), "Friend request sent 🌹");
  }

  function handleAccept(person: PersonInfo) {
    if (!person.requestId) return;

    return runAction(
      person.requestId,
      () => acceptFriendRequest(person.requestId!),
      "Friend request accepted! 🌹",
    );
  }

  function handleDecline(person: PersonInfo) {
    if (!person.requestId) return;

    return runAction(
      person.requestId,
      () => declineFriendRequest(person.requestId!),
      "Friend request declined.",
    );
  }

  const isLoading =
    tab === "friends"
      ? friendsLoading
      : tab === "requests"
        ? requestsLoading
        : tab === "following"
          ? followingLoading
          : tab === "followers"
            ? followersLoading
            : profilesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border border-border bg-card p-5 max-h-[85vh] flex flex-col rounded-2xl shadow-xl">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="font-display text-xl flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-[#E91E63]" />
            Connections
          </DialogTitle>

          <p className="text-xs text-muted-foreground">
            Manage your friends, followers, and network.
          </p>
        </DialogHeader>

        <div className="relative pt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members..."
            className="h-10 rounded-xl bg-secondary/50 pl-9 text-xs border-border"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto py-2">
          {(
            [
              { id: "friends", label: `Friends (${friends.length})` },
              {
                id: "requests",
                label: `Requests (${incomingRequests.length})`,
              },
              {
                id: "following",
                label: `Following (${following.length})`,
              },
              {
                id: "followers",
                label: `Followers (${followers.length})`,
              },
              { id: "suggested", label: "Discover" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0 ${
                tab === item.id
                  ? "bg-[#E91E63] text-white shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-[#E91E63]" />
              <p className="text-xs">Loading connections...</p>
            </div>
          ) : currentList.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="font-semibold text-foreground text-sm">No members here yet</p>

              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {tab === "requests"
                  ? "You have no incoming friend requests."
                  : tab === "friends"
                    ? "Connect with members to grow your network."
                    : tab === "suggested"
                      ? "No new members to discover right now."
                      : "No members found here yet."}
              </p>
            </div>
          ) : (
            currentList.map((person) => {
              const isFollowing = followingIds.includes(person.id);
              const isFriend = friendIds.includes(person.id);
              const hasSentRequest = outgoingIds.includes(person.id);
              const isBusy = busyId === person.id || busyId === person.requestId;

              return (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 p-2.5 hover:bg-secondary/60 transition-colors border border-border/50"
                >
                  <Link
                    to="/u/$username"
                    params={{ username: person.username }}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 min-w-0 group"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar
                        profile={{
                          avatar_url: person.avatarUrl ?? null,
                          username: person.username,
                          display_name: person.name,
                        }}
                        className="h-10 w-10 text-xs ring-1 ring-border shrink-0"
                      />
                      <PresenceDot
                        isOnline={isOnline(person.id)}
                        lastSeenAt={getEffectiveLastSeen(person.id, person.lastSeenAt)}
                        size="sm"
                        className="absolute bottom-0 right-0"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-[#E91E63] transition-colors">
                        {person.name}
                      </p>

                      <div className="flex items-center gap-1.5">
                        <p className="text-[0.65rem] text-muted-foreground truncate">
                          @{person.username}
                        </p>
                        <PresenceStatusText
                          isOnline={isOnline(person.id)}
                          lastSeenAt={getEffectiveLastSeen(person.id, person.lastSeenAt)}
                          nowMs={nowMs}
                          className="text-[10px]"
                        />
                      </div>

                      {person.bio && (
                        <p className="text-[0.65rem] text-muted-foreground truncate mt-0.5">
                          {person.bio}
                        </p>
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {tab === "requests" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleAccept(person)}
                          className="h-7 px-3 rounded-lg text-xs bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Accept
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => handleDecline(person)}
                          className="h-7 px-2 rounded-lg text-xs hover:bg-secondary"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {tab !== "followers" && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handleFollow(person)}
                            className={`h-7 px-2.5 rounded-lg text-[0.7rem] ${
                              isFollowing
                                ? "border border-border text-foreground bg-secondary/80 hover:bg-secondary"
                                : "bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm"
                            }`}
                          >
                            {isFollowing ? (
                              <>
                                <UserCheck className="h-3 w-3 mr-1" />
                                Following
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-3 w-3 mr-1" />
                                Follow
                              </>
                            )}
                          </Button>
                        )}

                        {!isFriend && !hasSentRequest && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => handleFriendRequest(person)}
                            className="h-7 px-2.5 rounded-lg text-[0.7rem] border-border"
                          >
                            + Friend
                          </Button>
                        )}

                        {hasSentRequest && (
                          <span className="text-[0.65rem] text-muted-foreground px-1">Pending</span>
                        )}

                        {isFriend && (
                          <span className="text-[0.65rem] text-[#E91E63] font-medium px-1">
                            Friends ✓
                          </span>
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
