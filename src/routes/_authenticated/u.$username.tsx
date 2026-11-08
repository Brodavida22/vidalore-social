import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  MapPin,
  Share2,
  UserPen,
  Award,
  Sparkles,
  Grid,
  Image as ImageIcon,
  Video,
  Bookmark,
  Info,
  UserCheck,
  UserPlus,
  Shield,
  MoreVertical,
  Flag,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  getStoredPosts,
  getStoredRelationships,
  toggleFollow,
  sendFriendRequest,
  blockUser,
  type SocialPost,
} from "@/services/social";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — VIDALORE SOCIAL` },
      { name: "description", content: `@${params.username}'s profile in the Rose Garden.` },
      { property: "og:title", content: `@${params.username} — VIDALORE SOCIAL` },
      {
        property: "og:description",
        content: `See @${params.username}'s moments on VIDALORE SOCIAL.`,
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { data: profile, isLoading, error, refetch } = useQuery(profileByUsernameQuery(username));
  const { data: me } = useQuery(myProfileQuery());
  const { data: achievements } = useQuery({
    ...achievementsForUserQuery(profile?.id ?? ""),
    enabled: !!profile,
  });

  const [activeTab, setActiveTab] = useState<
    "posts" | "photos" | "videos" | "saved" | "achievements" | "about"
  >("posts");
  const [reportOpen, setReportOpen] = useState(false);
  const [relState, setRelState] = useState(() => getStoredRelationships());

  const isMe = me?.id === profile?.id;
  const isFollowing = profile ? relState.following.includes(profile.id) : false;
  const isFriend = profile ? relState.friends.includes(profile.id) : false;
  const hasSentFriendRequest = profile
    ? relState.outgoingFriendRequests.includes(profile.id)
    : false;

  const allPosts = getStoredPosts();
  const userPosts = allPosts.filter(
    (p) =>
      p.authorUsername.toLowerCase() === username.toLowerCase() ||
      (profile && p.authorId === profile.id),
  );
  const userPhotos = userPosts.flatMap((p) =>
    (p.media || []).filter((m) => m.type === "image").map((m) => ({ ...m, postId: p.id })),
  );
  const userVideos = userPosts.flatMap((p) =>
    (p.media || []).filter((m) => m.type === "video").map((m) => ({ ...m, postId: p.id })),
  );
  const savedPosts = allPosts.filter((p) => p.hasSaved);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-4 space-y-4">
        <Skeleton className="h-44 sm:h-56 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-muted-foreground">Couldn't load this profile.</p>
        <Button variant="glass" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-14 text-center space-y-3">
        <span className="text-4xl">🥀</span>
        <h1 className="text-3xl font-semibold">No one by that name</h1>
        <p className="text-muted-foreground">@{username} hasn't bloomed in the garden yet.</p>
        <Button asChild variant="rose" className="mt-2">
          <Link to="/home">Return to Garden</Link>
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
        await navigator.share({ title: `@${profile!.username} on VIDALORE SOCIAL`, url });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    }
  }

  function handleFollowToggle() {
    if (!profile) return;
    const isNow = toggleFollow(profile.id);
    setRelState(getStoredRelationships());
    toast.info(isNow ? `Following @${profile.username} 🌹` : `Unfollowed @${profile.username}`);
  }

  function handleFriendRequest() {
    if (!profile) return;
    sendFriendRequest(profile.id);
    setRelState(getStoredRelationships());
    toast.success(`Friend request sent to @${profile.username} 🌹`);
  }

  function handleBlock() {
    if (!profile) return;
    blockUser(profile.id);
    setRelState(getStoredRelationships());
    toast.success(`Blocked @${profile.username}`);
  }

  return (
    <div className="mx-auto max-w-3xl pb-12 px-3 sm:px-4">
      {/* Cover Photo */}
      <div className="relative h-44 sm:h-60 overflow-hidden bg-garden rounded-b-3xl md:mt-4 md:rounded-3xl border border-border/70 shadow-card">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-burgundy via-background to-primary/30 flex items-center justify-center">
            <span className="font-display text-4xl opacity-20 tracking-widest text-primary">
              VIDALORE
            </span>
          </div>
        )}
      </div>

      {/* Profile Header Details */}
      <div className="px-2 sm:px-4">
        <div className="-mt-14 sm:-mt-16 flex items-end justify-between gap-3">
          <div className="relative">
            <UserAvatar
              profile={profile}
              className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background text-3xl sm:text-4xl shadow-xl ring-2 ring-primary/60"
            />
            {profile.points_balance > 500 && (
              <span
                title="Garden Contributor"
                className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-rose text-white shadow-glow text-xs"
              >
                🌹
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pb-1">
            <Button
              variant="glass"
              size="icon"
              onClick={shareProfile}
              aria-label="Share profile"
              className="rounded-full h-9 w-9"
            >
              <Share2 className="h-4 w-4" />
            </Button>

            {isMe ? (
              <Button
                asChild
                variant="rose"
                size="sm"
                className="rounded-full px-4 text-xs font-semibold shadow-glow"
              >
                <Link to="/settings/profile">
                  <UserPen className="h-3.5 w-3.5 mr-1.5" /> Edit Profile
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={isFollowing ? "glass" : "rose"}
                  onClick={handleFollowToggle}
                  className="rounded-full px-4 text-xs font-semibold shadow-glow"
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Follow
                    </>
                  )}
                </Button>

                {!isFriend && (
                  <Button
                    type="button"
                    size="sm"
                    variant="glass"
                    disabled={hasSentFriendRequest}
                    onClick={handleFriendRequest}
                    className="rounded-full px-3 text-xs"
                  >
                    {hasSentFriendRequest ? "Requested" : "+ Friend"}
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass border-border/80">
                    <DropdownMenuItem
                      onClick={() => setReportOpen(true)}
                      className="text-xs text-destructive"
                    >
                      <Flag className="h-3.5 w-3.5 mr-2" /> Report profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBlock} className="text-xs text-destructive">
                      <UserX className="h-3.5 w-3.5 mr-2" /> Block @{profile.username}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Name and bio */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
              {profile.display_name || profile.username}
            </h1>
            {profile.points_balance > 100 && (
              <span className="text-primary text-sm font-semibold" title="Blooming Gardener">
                🌹
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">@{profile.username}</p>

          {profile.bio && (
            <p className="mt-2 text-sm text-foreground/90 whitespace-pre-line leading-relaxed max-w-xl">
              {profile.bio}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-primary" /> {profile.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Joined {joined}
            </span>
            {profile.is_private && (
              <span className="flex items-center gap-1 text-rose-soft">
                <Shield className="h-3.5 w-3.5" /> Private Garden
              </span>
            )}
          </div>
        </div>

        {/* Social Counters */}
        <div className="mt-5 grid grid-cols-5 gap-1.5 sm:gap-2.5 text-center">
          <Stat label="Moments" value={userPosts.length.toString()} />
          <Stat label="Followers" value={isMe ? relState.followers.length.toString() : "42"} />
          <Stat label="Following" value={isMe ? relState.following.length.toString() : "28"} />
          <Stat label="Friends" value={isMe ? relState.friends.length.toString() : "19"} />
          <Stat label="VIDA POINTS" value={`🌹 ${profile.points_balance}`} highlight />
        </div>

        {/* Profile Tabs Navigation */}
        <div className="mt-6 flex border-b border-border/60 overflow-x-auto scrollbar-none">
          <TabButton
            active={activeTab === "posts"}
            onClick={() => setActiveTab("posts")}
            icon={Grid}
            label={`Posts (${userPosts.length})`}
          />
          <TabButton
            active={activeTab === "photos"}
            onClick={() => setActiveTab("photos")}
            icon={ImageIcon}
            label={`Photos (${userPhotos.length})`}
          />
          <TabButton
            active={activeTab === "videos"}
            onClick={() => setActiveTab("videos")}
            icon={Video}
            label={`Videos (${userVideos.length})`}
          />
          {isMe && (
            <TabButton
              active={activeTab === "saved"}
              onClick={() => setActiveTab("saved")}
              icon={Bookmark}
              label={`Saved (${savedPosts.length})`}
            />
          )}
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
        <div className="mt-5">
          {/* Posts Tab */}
          {activeTab === "posts" && (
            <div className="space-y-4">
              {userPosts.length === 0 ? (
                <div className="glass rounded-3xl p-10 text-center space-y-2 border border-border/80">
                  <span className="text-3xl">🌹</span>
                  <p className="font-semibold text-foreground">No moments shared yet</p>
                  <p className="text-xs text-muted-foreground">
                    {isMe
                      ? "Plant your first thought in the garden feed!"
                      : `@${profile.username} hasn't published any moments.`}
                  </p>
                </div>
              ) : (
                userPosts.map((post) => <PostCard key={post.id} post={post} me={me ?? null} />)
              )}
            </div>
          )}

          {/* Photos Tab */}
          {activeTab === "photos" && (
            <div>
              {userPhotos.length === 0 ? (
                <div className="glass rounded-3xl p-10 text-center space-y-2">
                  <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="font-semibold text-foreground">No photos yet</p>
                  <p className="text-xs text-muted-foreground">
                    Photos attached to moments will show here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {userPhotos.map((photo, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-2xl overflow-hidden bg-black/30 group relative"
                    >
                      <img
                        src={photo.url}
                        alt=""
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Videos Tab */}
          {activeTab === "videos" && (
            <div>
              {userVideos.length === 0 ? (
                <div className="glass rounded-3xl p-10 text-center space-y-2">
                  <Video className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="font-semibold text-foreground">No videos yet</p>
                  <p className="text-xs text-muted-foreground">
                    Video clips and reels will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {userVideos.map((vid, i) => (
                    <div
                      key={i}
                      className="aspect-[9/16] rounded-2xl overflow-hidden bg-black relative"
                    >
                      <video src={vid.url} className="h-full w-full object-cover" muted />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Saved Tab (only on isMe) */}
          {activeTab === "saved" && isMe && (
            <div className="space-y-4">
              {savedPosts.length === 0 ? (
                <div className="glass rounded-3xl p-10 text-center space-y-2">
                  <Bookmark className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="font-semibold text-foreground">No saved posts</p>
                  <p className="text-xs text-muted-foreground">
                    Bookmark posts from the feed to view them here.
                  </p>
                </div>
              ) : (
                savedPosts.map((post) => <PostCard key={post.id} post={post} me={me ?? null} />)
              )}
            </div>
          )}

          {/* Achievements Tab */}
          {activeTab === "achievements" && (
            <section className="glass rounded-3xl p-5 border border-border/80">
              <h2 className="flex items-center gap-2 text-xl font-semibold mb-3">
                <Award className="h-5 w-5 text-primary" />
                Garden Achievements
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {achievements?.length ? (
                  achievements.map((a) => (
                    <div
                      key={a.achievements?.code}
                      className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3 border border-border/60"
                    >
                      <span className="text-2xl">🏵️</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {a.achievements?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.achievements?.description}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-4 col-span-2 text-center">
                    No achievements unlocked yet. Complete profile and share moments to earn awards!
                  </p>
                )}
              </div>
            </section>
          )}

          {/* About Tab */}
          {activeTab === "about" && (
            <section className="glass rounded-3xl p-5 space-y-4 border border-border/80">
              <h2 className="text-xl font-semibold">About @{profile.username}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-muted-foreground">Garden Status</p>
                  <p className="font-semibold text-foreground mt-0.5">Active Member 🌹</p>
                </div>
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-muted-foreground">Privacy</p>
                  <p className="font-semibold text-foreground mt-0.5">
                    {profile.is_private ? "Private Account (Followers only)" : "Public Garden"}
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-muted-foreground">Member Since</p>
                  <p className="font-semibold text-foreground mt-0.5">{joined}</p>
                </div>
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <p className="text-muted-foreground">VIDA Points Balance</p>
                  <p className="font-semibold text-rose-soft mt-0.5">
                    🌹 {profile.points_balance} points
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

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

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-2.5 sm:p-3 transition-all ${highlight ? "bg-gradient-rose text-primary-foreground shadow-glow" : "glass"}`}
    >
      <p className="font-semibold text-xs sm:text-sm truncate">{value}</p>
      <p
        className={`text-[0.65rem] sm:text-[0.7rem] truncate ${highlight ? "text-primary-foreground/90 font-medium" : "text-muted-foreground"}`}
      >
        {label}
      </p>
    </div>
  );
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
      className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px shrink-0 ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
