import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Users, Compass, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PostComposer } from "@/components/feed/PostComposer";
import { PostCard } from "@/components/feed/PostCard";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { myProfileQuery } from "@/services/profiles";
import { feedQuery, postsKeys, type FeedMode } from "@/services/posts";
import { blockedIdsQuery } from "@/services/blocks";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — VIDALORE SOCIAL" },
      { name: "description", content: "Your VIDALORE SOCIAL feed and community updates." },
      { property: "og:title", content: "Home — VIDALORE SOCIAL" },
      { property: "og:description", content: "Connect, share and explore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(myProfileQuery());
  const { data: blockedIds = [] } = useQuery(blockedIdsQuery());

  const [feedFilter, setFeedFilter] = useState<FeedMode>("for-you");

  const {
    data: allFeedPosts = [],
    isLoading: loadingPosts,
    isRefetching,
    refetch,
  } = useQuery(feedQuery(feedFilter));

  const blockedSet = new Set(blockedIds);
  const posts = allFeedPosts.filter((p) => !blockedSet.has(p.authorId));

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: postsKeys.all });
    await refetch();
  }

  return (
    <div className="flex justify-center mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
      {/* Central feed column */}
      <div className="w-full max-w-2xl min-w-0 space-y-4 py-3 sm:py-5">
        {/* 2. Stories Section */}
        <StoriesBar me={me} />

        {/* 3. Create Post / Composer Section */}
        {me && <PostComposer me={me} onPostCreated={handleRefresh} />}

        {/* 4. Feed Filter Tabs */}
        <div className="flex items-center justify-between border-b border-border pb-2 px-1">
          <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setFeedFilter("for-you")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                feedFilter === "for-you"
                  ? "bg-card text-[#E91E63] shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Compass className="h-3.5 w-3.5" /> For You
            </button>

            <button
              type="button"
              onClick={() => setFeedFilter("following")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                feedFilter === "following"
                  ? "bg-card text-[#E91E63] shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" /> Following
            </button>

            <button
              type="button"
              onClick={() => setFeedFilter("trending")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                feedFilter === "trending"
                  ? "bg-card text-[#E91E63] shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Flame className="h-3.5 w-3.5" /> Trending
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh feed"
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                loadingPosts || isRefetching ? "animate-spin text-[#E91E63]" : ""
              }`}
            />
          </button>
        </div>

        {/* 5. Actual Posts from Users / Clean Empty State */}
        {loadingPosts ? (
          <div className="space-y-4">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        ) : posts.length === 0 ? (
          <section className="rounded-xl p-10 text-center space-y-2 border border-border bg-card">
            <h2 className="font-display text-base font-semibold text-foreground">No posts yet</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Posts from people you follow will appear here.
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
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
            ))}
          </div>
        )}
      </div>

      {/* Right discovery sidebar on desktop */}
      <RightSidebar me={me} />
    </div>
  );
}
