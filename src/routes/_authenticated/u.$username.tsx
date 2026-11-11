import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  MapPin,
  Share2,
  UserPen,
  Award,
  Grid,
  Clapperboard,
  Bookmark,
  Info,
  UserCheck,
  UserPlus,
  Shield,
  MoreVertical,
  Flag,
  UserX,
  BadgeCheck,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { PostCard } from "@/components/feed/PostCard";
import { ReportModal } from "@/components/feed/ReportModal";
import {
  achievementsForUserQuery,
  myProfileQuery,
  profileByUsernameQuery,
} from "@/services/profiles";
import { getStoredRelationships, sendFriendRequest } from "@/services/social";
import { blockUser, unblockUser, blocksKeys, blockedIdsQuery } from "@/services/blocks";
import { userPostsQuery, mentionPostsQuery, postsKeys } from "@/services/posts";
import { getStoredReels } from "@/services/reelsAndStories";
import { supabase } from "@/integrations/supabase/client";

import {
  getFollowCounts,
  getFollowers,
  getFollowing,
  isFollowing as checkIsFollowing,
  followUser,
  unfollowUser,
  sendFriendRequest as sendSupabaseFriendRequest,
  getFriendRequestStatus,
} from "@/services/relationships";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — VIDALORE SOCIAL` },
      {
        name: "description",
        content: `@${params.username}'s profile on VIDALORE SOCIAL.`,
      },
      {
        property: "og:title",
        content: `@${params.username} — VIDALORE SOCIAL`,
      },
      {
        property: "og:description",
        content: `See @${params.username}'s posts on VIDALORE SOCIAL.`,
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error, refetch } = useQuery(profileByUsernameQuery(username));

  const { data: me } = useQuery(myProfileQuery());

  const { data: achievements } = useQuery({
    ...achievementsForUserQuery(profile?.id ?? ""),
    enabled: !!profile,
  });

  const [activeTab, setActiveTab] = useState<
    "posts" | "reels" | "tagged" | "achievements" | "about"
  >("posts");

  const [reportOpen, setReportOpen] = useState(false);
  const [followListOpen, setFollowListOpen] = useState(false);

  const [followListType, setFollowListType] = useState<"followers" | "following">("followers");

  const [relState, setRelState] = useState(() => getStoredRelationships());

  const isMe = me?.id === profile?.id;

  const { data: followCounts } = useQuery({
    queryKey: ["follow-counts", profile?.id],
    queryFn: () => getFollowCounts(profile!.id),
    enabled: !!profile,
  });

  const { data: isFollowingUser, isLoading: isFollowingLoading } = useQuery({
    queryKey: ["is-following", profile?.id],
    queryFn: () => checkIsFollowing(profile!.id),
    enabled: !!profile && !isMe,
  });

  const { data: friendStatus, refetch: refetchFriendStatus } = useQuery({
    queryKey: ["friend-status", profile?.id],
    queryFn: () => getFriendRequestStatus(profile!.id),
    enabled: !!profile && !isMe,
  });

  const isFollowing = isFollowingUser ?? false;

  const isFriend =
    friendStatus?.status === "accepted" ||
    (profile ? relState.friends.includes(profile.id) : false);

  const hasSentFriendRequest =
    friendStatus?.status === "pending" ||
    (profile ? relState.outgoingFriendRequests.includes(profile.id) : false);

  const { data: blockedIds = [] } = useQuery(blockedIdsQuery());

  const isUserBlocked = Boolean(profile && blockedIds.includes(profile.id));

  // Load the selected profile's followers or following list.
  const {
    data: followList = [],
    isLoading: followListLoading,
    isError: followListError,
    refetch: refetchFollowList,
  } = useQuery({
    queryKey: ["profile-follow-list", profile?.id, followListType],
    queryFn: () =>
      followListType === "followers" ? getFollowers(profile!.id) : getFollowing(profile!.id),
    enabled: !!profile?.id && followListOpen,
  });

  // Load the accounts followed by the currently signed-in user.
  // This determines whether each person in the list should show
  // Follow or Following.
  const {
    data: viewerFollowingIds = [],
    isLoading: viewerFollowingLoading,
    isError: viewerFollowingError,
  } = useQuery({
    queryKey: ["viewer-following-ids"],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!auth.user) return [];

      const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", auth.user.id);

      if (error) throw error;

      return (data ?? []).map((item) => item.following_id);
    },
    enabled: followListOpen,
  });

  useEffect(() => {
    const handleUpdate = () => {
      void queryClient.invalidateQueries({
        queryKey: ["reels", "all"],
      });
    };

    window.addEventListener("vidalore:reels-updated", handleUpdate);

    return () => window.removeEventListener("vidalore:reels-updated", handleUpdate);
  }, [queryClient]);

  const {
    data: userPosts = [],
    isLoading: userPostsLoading,
    refetch: refetchUserPosts,
  } = useQuery({
    ...userPostsQuery(profile?.id ?? ""),
    enabled: !!profile?.id,
  });

  const {
    data: taggedPosts = [],
    isLoading: taggedPostsLoading,
    refetch: refetchTaggedPosts,
  } = useQuery({
    ...mentionPostsQuery(profile?.username ?? username),
    enabled: !!profile?.username || !!username,
  });

  const reelsQuery = useQuery({
    queryKey: ["reels", "all"],
    queryFn: getStoredReels,
  });

  const allReels = reelsQuery.data ?? [];

  const userReels = (Array.isArray(allReels) ? allReels : []).filter(
    (r) =>
      r.creatorUsername.toLowerCase() === username.toLowerCase() ||
      (profile && r.creatorId === profile.id),
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-4 space-y-4">
        <Skeleton className="h-44 sm:h-56 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-muted-foreground text-sm">Couldn't load this profile.</p>

        <Button variant="outline" onClick={() => refetch()} className="text-xs rounded-lg">
          Retry
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-14 text-center space-y-3">
        <h1 className="text-2xl font-bold text-foreground">User not found</h1>

        <p className="text-muted-foreground text-xs">@{username} doesn't exist or was removed.</p>

        <Button
          asChild
          className="mt-2 text-xs rounded-lg bg-[#E91E63] hover:bg-[#C2185B] text-white"
        >
          <Link to="/home">Return to Home</Link>
        </Button>
      </div>
    );
  }

  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  async function shareProfile() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `@${profile.username} on VIDALORE SOCIAL`,
          url,
        });
      } catch {
        // Sharing was cancelled or unavailable.
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      } catch {
        toast.error("Couldn't copy profile link.");
      }
    }
  }

  async function handleFollowToggle() {
    try {
      if (isFollowing) {
        await unfollowUser(profile.id);
        toast.success(`Unfollowed @${profile.username}`);
      } else {
        await followUser(profile.id);
        toast.success(`Following @${profile.username}`);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["is-following", profile.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["follow-counts"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["viewer-following-ids"],
        }),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't update follow status. Please try again.",
      );
    }
  }

  async function handleListFollowToggle(person: (typeof followList)[number]) {
    const currentlyFollowing = viewerFollowingIds.includes(person.id);

    try {
      if (currentlyFollowing) {
        await unfollowUser(person.id);
        toast.success(`Unfollowed @${person.username}`);
      } else {
        await followUser(person.id);
        toast.success(`Following @${person.username}`);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["viewer-following-ids"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["follow-counts"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["is-following"],
        }),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't update follow status. Please try again.",
      );
    }
  }

  async function handleFriendRequest() {
    try {
      await sendSupabaseFriendRequest(profile.id);
      await refetchFriendStatus();

      toast.success(`Friend request sent to @${profile.username}`);
    } catch {
      sendFriendRequest(profile.id);
      setRelState(getStoredRelationships());

      toast.success(`Friend request sent to @${profile.username}`);
    }
  }

  async function handleBlockToggle() {
    try {
      if (isUserBlocked) {
        await unblockUser(profile.id);
        toast.success(`Unblocked @${profile.username}`);
      } else {
        await blockUser(profile.id);

        toast.success(`Blocked @${profile.username}`, {
          description: "Their posts and interactions are now hidden from your feeds.",
        });
      }

      await queryClient.invalidateQueries({
        queryKey: blocksKeys.all,
      });

      await queryClient.invalidateQueries({
        queryKey: postsKeys.all,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update block status.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-16 px-3 sm:px-4">
      {/* Cover Photo */}
      <div className="relative h-40 sm:h-52 overflow-hidden bg-secondary md:mt-4 md:rounded-xl border border-border shadow-sm">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[#111111] flex items-center justify-center">
            <span className="font-display text-2xl font-black tracking-widest text-white/20 select-none">
              VIDA<span className="text-[#E91E63]">LORE</span>
            </span>
          </div>
        )}
      </div>

      {/* Profile Header Details */}
      <div className="px-2 sm:px-4">
        <div className="-mt-12 sm:-mt-16 flex items-end justify-between gap-3">
          <div className="relative">
            <UserAvatar
              profile={profile}
              className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-background text-2xl sm:text-3xl shadow-md ring-2 ring-[#E91E63]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pb-1">
            <Button
              variant="outline"
              size="icon"
              onClick={shareProfile}
              aria-label="Share profile"
              className="rounded-lg h-9 w-9 border-border"
            >
              <Share2 className="h-4 w-4" />
            </Button>

            {isMe ? (
              <Button
                asChild
                size="sm"
                className="rounded-lg px-4 text-xs font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm"
              >
                <Link to="/settings/profile">
                  <UserPen className="h-3.5 w-3.5 mr-1.5" />
                  Edit Profile
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={isFollowing ? "outline" : "default"}
                  disabled={isFollowingLoading}
                  onClick={handleFollowToggle}
                  className={`rounded-lg px-4 text-xs font-semibold ${
                    isFollowing
                      ? "border-border text-foreground hover:bg-secondary"
                      : "bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm"
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      Follow
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate({ to: "/messages" })}
                  className="rounded-lg px-3.5 text-xs border-border"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5 text-[#E91E63]" />
                  Message
                </Button>

                {!isFriend && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={hasSentFriendRequest}
                    onClick={handleFriendRequest}
                    className="rounded-lg px-3 text-xs border-border hidden sm:inline-flex"
                  >
                    {hasSentFriendRequest ? "Requested" : "+ Friend"}
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-secondary"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="bg-popover border-border">
                    <DropdownMenuItem
                      onClick={() => setReportOpen(true)}
                      className="text-xs text-destructive cursor-pointer"
                    >
                      <Flag className="h-3.5 w-3.5 mr-2" />
                      Report profile
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={handleBlockToggle}
                      className="text-xs text-destructive cursor-pointer"
                    >
                      <UserX className="h-3.5 w-3.5 mr-2" />
                      {isUserBlocked
                        ? `Unblock @${profile.username}`
                        : `Block @${profile.username}`}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Name and Bio */}
        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {profile.display_name || profile.username}
            </h1>

            {profile.points_balance > 100 && <BadgeCheck className="h-4 w-4 text-[#E91E63]" />}
          </div>

          <p className="text-xs text-muted-foreground">@{profile.username}</p>

          {profile.bio && (
            <p className="mt-2 text-xs sm:text-sm text-foreground whitespace-pre-line leading-relaxed max-w-xl">
              {profile.bio}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-[#E91E63]" />
                {profile.location}
              </span>
            )}

            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Joined {joined}
            </span>

            {profile.is_private && (
              <span className="flex items-center gap-1 text-[#E91E63]">
                <Shield className="h-3.5 w-3.5" />
                Private Account
              </span>
            )}
          </div>
        </div>

        {/* Blocked Notification Banner */}
        {isUserBlocked && (
          <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-destructive font-medium">
              <UserX className="h-4 w-4 shrink-0" />
              <span>
                You have blocked @{profile.username}. Their posts and activity are hidden.
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleBlockToggle}
              className="text-xs h-7 rounded-lg border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              Unblock
            </Button>
          </div>
        )}

        {/* Social Counters */}
        <div className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
          <Stat label="Posts" value={userPosts.length.toString()} />

          <Stat
            label="Followers"
            value={(followCounts?.followers ?? 0).toString()}
            onClick={() => {
              setFollowListType("followers");
              setFollowListOpen(true);
            }}
          />

          <Stat
            label="Following"
            value={(followCounts?.following ?? 0).toString()}
            onClick={() => {
              setFollowListType("following");
              setFollowListOpen(true);
            }}
          />

          <Stat label="Points" value={profile.points_balance.toString()} highlight />
        </div>

        {/* Profile Tabs */}
        <div className="mt-5 flex border-b border-border overflow-x-auto scrollbar-none">
          <TabButton
            active={activeTab === "posts"}
            onClick={() => setActiveTab("posts")}
            icon={Grid}
            label={`Posts (${userPosts.length})`}
          />

          <TabButton
            active={activeTab === "reels"}
            onClick={() => setActiveTab("reels")}
            icon={Clapperboard}
            label={`Reels (${userReels.length})`}
          />

          <TabButton
            active={activeTab === "tagged"}
            onClick={() => setActiveTab("tagged")}
            icon={Bookmark}
            label={`Tagged (${taggedPosts.length})`}
          />

          <TabButton
            active={activeTab === "achievements"}
            onClick={() => setActiveTab("achievements")}
            icon={Award}
            label={`Awards (${achievements?.length ?? 0})`}
          />

          <TabButton
            active={activeTab === "about"}
            onClick={() => setActiveTab("about")}
            icon={Info}
            label="About"
          />
        </div>

        {/* Active Tab Content */}
        <div className="mt-4">
          {/* Posts Tab */}
          {activeTab === "posts" && (
            <div className="space-y-4">
              {userPostsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-44 rounded-xl" />
                  <Skeleton className="h-44 rounded-xl" />
                </div>
              ) : userPosts.length === 0 ? (
                <div className="rounded-xl p-8 text-center space-y-2 border border-border bg-card">
                  <p className="font-semibold text-foreground text-sm">No posts shared yet</p>

                  <p className="text-xs text-muted-foreground">
                    {isMe
                      ? "Publish your first post to appear here!"
                      : `@${profile.username} hasn't published any posts.`}
                  </p>
                </div>
              ) : (
                userPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    me={me ?? null}
                    onDeleted={() => {
                      refetchUserPosts();
                      refetchTaggedPosts();
                    }}
                    onPostUpdated={() => {
                      refetchUserPosts();
                      refetchTaggedPosts();
                    }}
                  />
                ))
              )}
            </div>
          )}

          {/* Reels Tab */}
          {activeTab === "reels" && (
            <div>
              {userReels.length === 0 ? (
                <div className="rounded-xl p-8 text-center space-y-2 border border-border bg-card">
                  <Clapperboard className="h-8 w-8 text-muted-foreground mx-auto" />

                  <p className="font-semibold text-foreground text-sm">No reels uploaded</p>

                  <p className="text-xs text-muted-foreground">
                    Vertical video reels will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {userReels.map((reel) => (
                    <div
                      key={reel.id}
                      onClick={() => navigate({ to: "/reels" })}
                      className="aspect-[9/16] rounded-xl overflow-hidden bg-black relative border border-border cursor-pointer group"
                    >
                      <video
                        src={reel.videoUrl || undefined}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        onError={(e) => {
                          e.stopPropagation();
                          e.currentTarget.style.display = "none";
                        }}
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                        <span className="text-[0.65rem] text-white font-medium line-clamp-1">
                          {reel.caption}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tagged Tab */}
          {activeTab === "tagged" && (
            <div className="space-y-4">
              {taggedPostsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-44 rounded-xl" />
                </div>
              ) : taggedPosts.length === 0 ? (
                <div className="rounded-xl p-8 text-center space-y-2 border border-border bg-card">
                  <Bookmark className="h-8 w-8 text-muted-foreground mx-auto" />

                  <p className="font-semibold text-foreground text-sm">No tagged posts</p>

                  <p className="text-xs text-muted-foreground">
                    Posts mentioning @{profile.username} will show here.
                  </p>
                </div>
              ) : (
                taggedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    me={me ?? null}
                    onDeleted={() => {
                      refetchUserPosts();
                      refetchTaggedPosts();
                    }}
                    onPostUpdated={() => {
                      refetchUserPosts();
                      refetchTaggedPosts();
                    }}
                  />
                ))
              )}
            </div>
          )}

          {/* Achievements Tab */}
          {activeTab === "achievements" && (
            <section className="rounded-xl p-5 border border-border bg-card shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold mb-3 text-foreground">
                <Award className="h-4 w-4 text-[#E91E63]" />
                Community Achievements
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {achievements?.length ? (
                  achievements.map((a) => (
                    <div
                      key={a.achievements?.code}
                      className="flex items-center gap-3 rounded-lg bg-secondary p-3 border border-border"
                    >
                      <Award className="h-6 w-6 text-[#E91E63] shrink-0" />

                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {a.achievements?.name}
                        </p>

                        <p className="text-[0.7rem] text-muted-foreground">
                          {a.achievements?.description}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-4 col-span-2 text-center">
                    No achievements unlocked yet. Participate and post to earn badges.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* About Tab */}
          {activeTab === "about" && (
            <section className="rounded-xl p-5 space-y-3 border border-border bg-card shadow-sm">
              <h2 className="text-base font-semibold text-foreground">About @{profile.username}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-secondary p-3 border border-border">
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-semibold text-foreground mt-0.5">Active Member</p>
                </div>

                <div className="rounded-lg bg-secondary p-3 border border-border">
                  <p className="text-muted-foreground">Privacy</p>
                  <p className="font-semibold text-foreground mt-0.5">
                    {profile.is_private ? "Private Account (Followers only)" : "Public Account"}
                  </p>
                </div>

                <div className="rounded-lg bg-secondary p-3 border border-border">
                  <p className="text-muted-foreground">Member Since</p>
                  <p className="font-semibold text-foreground mt-0.5">{joined}</p>
                </div>

                <div className="rounded-lg bg-secondary p-3 border border-border">
                  <p className="text-muted-foreground">VIDA Points</p>
                  <p className="font-semibold text-[#E91E63] mt-0.5">
                    {profile.points_balance} points
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Followers and Following Dialog */}
      <Dialog open={followListOpen} onOpenChange={setFollowListOpen}>
        <DialogContent className="max-w-md bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {followListType === "followers" ? "Followers" : "Following"}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
            {followListLoading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            ) : followListError ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-destructive">Couldn't load this list.</p>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refetchFollowList()}
                >
                  Try again
                </Button>
              </div>
            ) : followList.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {followListType === "followers"
                  ? "Nobody follows this account yet."
                  : "This account isn't following anyone yet."}
              </p>
            ) : (
              followList.map((person) => {
                const isViewerFollowing = viewerFollowingIds.includes(person.id);

                const isSelf = person.id === me?.id;

                return (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 rounded-xl p-3 hover:bg-secondary/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setFollowListOpen(false);

                        navigate({
                          to: "/u/$username",
                          params: {
                            username: person.username,
                          },
                        });
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <UserAvatar profile={person} className="h-11 w-11 shrink-0" />

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {person.display_name || person.username}
                        </p>

                        <p className="text-xs text-muted-foreground truncate">@{person.username}</p>
                      </div>
                    </button>

                    {!isSelf && (
                      <Button
                        type="button"
                        size="sm"
                        variant={isViewerFollowing ? "outline" : "default"}
                        disabled={viewerFollowingLoading || viewerFollowingError}
                        onClick={() => void handleListFollowToggle(person)}
                        className={`shrink-0 rounded-lg text-xs px-3 ${
                          isViewerFollowing
                            ? "border-border text-foreground hover:bg-secondary"
                            : "bg-[#E91E63] hover:bg-[#C2185B] text-white"
                        }`}
                      >
                        {isViewerFollowing ? (
                          <>
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5 mr-1" />
                            Follow
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ReportModal
        targetId={profile.id}
        targetType="profile"
        targetLabel={`@${profile.username}'s profile`}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  onClick,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const className = `rounded-lg p-2.5 transition-colors border ${
    highlight
      ? "bg-[#E91E63] text-white border-[#E91E63] font-semibold"
      : "bg-card text-foreground border-border"
  }`;

  const content = (
    <>
      <p className="font-semibold text-xs sm:text-sm truncate">{value}</p>

      <p
        className={`text-[0.65rem] truncate ${
          highlight ? "text-white/90 font-medium" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`View ${label}`}
        className={`${className} w-full cursor-pointer hover:bg-secondary/70 active:scale-95`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Grid;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px shrink-0 ${
        active
          ? "border-[#E91E63] text-[#E91E63]"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
