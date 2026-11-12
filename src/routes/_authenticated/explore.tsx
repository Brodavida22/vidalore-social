import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, Search, Sparkles, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { PostCard } from "@/components/feed/PostCard";
import { myProfileQuery, communityProfilesQuery } from "@/services/profiles";
import { explorePostsQuery } from "@/services/posts";
import { getStoredRelationships } from "@/services/social";
import { followUser, unfollowUser } from "@/services/relationships";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({
    meta: [
      { title: "Explore — VIDALORE SOCIAL" },
      {
        name: "description",
        content: "Discover inspiring creators, photography, and conversations.",
      },
      {
        property: "og:title",
        content: "Explore — VIDALORE SOCIAL",
      },
      {
        property: "og:description",
        content: "Discover inspiring creators and conversations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
});

const EXPLORE_CATEGORIES = [
  "All",
  "Design",
  "Technology",
  "Photography",
  "Architecture",
  "Community",
];

function ExplorePage() {
  const queryClient = useQueryClient();

  const { data: me } = useQuery(myProfileQuery());

  const { data: dbProfiles } = useQuery(communityProfilesQuery(10));

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [blockedUserIds] = useState(() => getStoredRelationships().blockedUsers);

  const [pendingFollowId, setPendingFollowId] = useState<string | null>(null);

  const tagFilter = selectedCategory === "All" ? null : selectedCategory;

  const { data: allExplorePosts = [], isLoading, refetch } = useQuery(explorePostsQuery(tagFilter));

  // Always read the signed-in user's following list from Supabase.
  // This keeps Explore synchronized with profile pages and the
  // Followers / Following lists.
  const {
    data: followingIds = [],
    isLoading: followingLoading,
    isError: followingError,
  } = useQuery({
    queryKey: ["viewer-following-ids", me?.id],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!auth.user) throw new Error("Please sign in to view following status.");

      const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", auth.user.id);

      if (error) throw error;
      return (data ?? []).map((item) => item.following_id);
    },
    enabled: !!me?.id,
  });

  async function handleFollowToggle(targetId: string) {
    if (!me?.id) {
      toast.error("Please sign in to follow people.");
      return;
    }

    if (me.id === targetId) return;
    if (pendingFollowId) return;

    const isCurrentlyFollowing = followingIds.includes(targetId);

    setPendingFollowId(targetId);

    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(targetId);
        toast.success("You unfollowed this creator.");
      } else {
        await followUser(targetId);
        toast.success("You are now following this creator.");
      }

      // Refresh all follow-related data so the profile pages,
      // follow lists and Explore buttons stay synchronized.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["viewer-following-ids"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["is-following"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["follow-counts"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["profile-follow-list"],
        }),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't update follow status. Please try again.",
      );
    } finally {
      setPendingFollowId(null);
    }
  }

  const filteredPosts = allExplorePosts.filter((p) => {
    if (blockedUserIds.includes(p.authorId)) return false;

    if (!search.trim()) return true;

    const q = search.toLowerCase();

    return (
      p.content.toLowerCase().includes(q) ||
      p.authorName.toLowerCase().includes(q) ||
      p.authorUsername.toLowerCase().includes(q) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 py-6 space-y-5">
      {/* Header & Search */}
      <div className="space-y-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2 text-foreground">
            <Compass className="h-6 w-6 text-[#E91E63]" />
            Explore
          </h1>

          <p className="text-xs text-muted-foreground mt-0.5">
            Discover creators, ideas, and active discussions across the network.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keywords, topics, or creators..."
            className="h-10 rounded-xl bg-secondary pl-10 text-xs border-border focus-visible:ring-primary"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {EXPLORE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-[#E91E63] text-white font-semibold"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              }`}
            >
              {cat === "All" ? "All Posts" : `#${cat}`}
            </button>
          ))}
        </div>
      </div>

      {/* Suggested Creators Carousel */}
      {dbProfiles && dbProfiles.length > 0 && (
        <section className="rounded-xl p-4 border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#E91E63]" />
              Featured Creators
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {dbProfiles.slice(0, 4).map((c) => {
              const isFollowing = followingIds.includes(c.id);

              const isPending = pendingFollowId === c.id;

              return (
                <div
                  key={c.id}
                  className="rounded-xl bg-secondary/50 p-3 text-center flex flex-col items-center justify-between space-y-2 border border-border hover:border-[#E91E63]/40 transition-colors"
                >
                  <Link to="/u/$username" params={{ username: c.username }} className="w-full">
                    <UserAvatar
                      profile={c}
                      className="h-11 w-11 text-xs ring-1 ring-border mx-auto"
                    />

                    <p className="mt-2 text-xs font-semibold text-foreground truncate max-w-[120px] mx-auto">
                      {c.display_name || c.username}
                    </p>

                    <p className="text-[0.65rem] text-muted-foreground mt-0.5">
                      {c.points_balance} pts
                    </p>
                  </Link>

                  {me?.id !== c.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant={isFollowing ? "outline" : "default"}
                      disabled={
                        followingLoading || followingError || isPending || !!pendingFollowId
                      }
                      onClick={() => void handleFollowToggle(c.id)}
                      className={`h-7 w-full rounded-lg text-[0.7rem] font-medium ${
                        isFollowing
                          ? "border-border text-foreground hover:bg-secondary"
                          : "bg-[#E91E63] hover:bg-[#C2185B] text-white"
                      }`}
                    >
                      {isPending ? (
                        <span>Updating...</span>
                      ) : isFollowing ? (
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
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Explore Grid / Feed */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-xl p-10 text-center space-y-2 border border-border bg-card">
            <p className="font-semibold text-foreground text-sm">No posts found</p>

            <p className="text-xs text-muted-foreground">
              Try adjusting your search query or selecting another topic.
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              me={me ?? null}
              onDeleted={() => {
                refetch();
              }}
              onPostUpdated={() => {
                refetch();
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
