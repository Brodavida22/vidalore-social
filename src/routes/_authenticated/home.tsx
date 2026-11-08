import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, UserPen, Flame, Clock, Users, Compass, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { PostComposer } from "@/components/feed/PostComposer";
import { PostCard } from "@/components/feed/PostCard";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { myProfileQuery, communityProfilesQuery, type Profile } from "@/services/profiles";
import { getStoredPosts, getStoredRelationships, type SocialPost } from "@/services/social";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home Garden — VIDALORE SOCIAL" },
      { name: "description", content: "Your VIDALORE SOCIAL home feed and garden circle." },
      { property: "og:title", content: "Home Garden — VIDALORE SOCIAL" },
      { property: "og:description", content: "Connect. Express. Play. Belong." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const CIRCLE_AVATARS = [
  {
    username: "celeste",
    name: "Celeste",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80",
    hasStory: true,
  },
  {
    username: "raphael",
    name: "Raphaël",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
    hasStory: true,
  },
  {
    username: "seraphina",
    name: "Seraphina",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80",
    hasStory: true,
  },
  {
    username: "adrian",
    name: "Adrian",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80",
    hasStory: false,
  },
];

function HomePage() {
  const { data: me, isLoading: profileLoading } = useQuery(myProfileQuery());
  const { data: communityProfiles } = useQuery(communityProfilesQuery(8));

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [feedFilter, setFeedFilter] = useState<"for-you" | "following" | "trending">("for-you");

  const reloadPosts = useCallback(() => {
    setLoadingPosts(true);
    setTimeout(() => {
      const stored = getStoredPosts();
      const rel = getStoredRelationships();

      // Filter blocked authors
      const safe = stored.filter((p) => !rel.blockedUsers.includes(p.authorId));

      if (feedFilter === "following") {
        setPosts(safe.filter((p) => rel.following.includes(p.authorId) || p.authorId === me?.id));
      } else if (feedFilter === "trending") {
        setPosts([...safe].sort((a, b) => b.reactionsCount - a.reactionsCount));
      } else {
        setPosts(safe);
      }
      setLoadingPosts(false);
    }, 250);
  }, [feedFilter, me?.id]);

  useEffect(() => {
    reloadPosts();
    const handleUpdate = () => reloadPosts();
    window.addEventListener("vidalore:social-updated", handleUpdate);
    return () => window.removeEventListener("vidalore:social-updated", handleUpdate);
  }, [reloadPosts]);

  const complete = me && me.avatar_url && me.display_name && me.bio;

  return (
    <div className="flex justify-center mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
      {/* Central feed column */}
      <div className="w-full max-w-2xl min-w-0 space-y-5 py-4 sm:py-6">
        {/* Welcome greeting banner */}
        {profileLoading || !me ? (
          <Skeleton className="h-28 rounded-3xl" />
        ) : (
          <section className="relative overflow-hidden rounded-3xl bg-garden p-5 sm:p-6 shadow-card border border-border/70">
            <div
              aria-hidden="true"
              className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-primary/20 blur-3xl pointer-events-none"
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-rose-soft font-semibold">
                  The Rose Garden 🌹
                </p>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold">
                  Welcome, {me.display_name || `@${me.username}`}
                </h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  You hold{" "}
                  <strong className="text-foreground">🌹 {me.points_balance} VIDA POINTS</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  asChild
                  variant="rose"
                  size="sm"
                  className="rounded-full shadow-glow text-xs"
                >
                  <Link to="/points">
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Points
                  </Link>
                </Button>
                {!complete && (
                  <Button asChild variant="glass" size="sm" className="rounded-full text-xs">
                    <Link to="/settings/profile">
                      <UserPen className="h-3.5 w-3.5 mr-1" /> Complete profile (+50)
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 24h Garden Stories Bar */}
        <StoriesBar me={me} />

        {/* Post Composer */}
        {me && <PostComposer me={me} onPostCreated={reloadPosts} />}

        {/* Feed Filter Tabs */}
        <div className="flex items-center justify-between border-b border-border/60 pb-2 px-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFeedFilter("for-you")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                feedFilter === "for-you"
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Compass className="h-3.5 w-3.5" /> For You
            </button>

            <button
              type="button"
              onClick={() => setFeedFilter("following")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                feedFilter === "following"
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" /> Following
            </button>

            <button
              type="button"
              onClick={() => setFeedFilter("trending")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                feedFilter === "trending"
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Flame className="h-3.5 w-3.5" /> Trending
            </button>
          </div>

          <button
            type="button"
            onClick={reloadPosts}
            title="Refresh feed"
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingPosts ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Posts Feed List */}
        {loadingPosts ? (
          <div className="space-y-4">
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        ) : posts.length === 0 ? (
          <section className="glass rounded-3xl p-10 text-center space-y-3 border border-border/80">
            <div className="flex justify-center text-4xl">🌹</div>
            <h2 className="font-display text-2xl font-semibold">The rose garden is tranquil</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {feedFilter === "following"
                ? "You haven't followed any creators who posted yet. Explore suggested creators in your circle!"
                : "No moments match this view yet. Be the first to plant a blooming thought!"}
            </p>
            {feedFilter === "following" ? (
              <Button
                type="button"
                variant="rose"
                size="sm"
                onClick={() => setFeedFilter("for-you")}
                className="rounded-full text-xs shadow-glow"
              >
                View All Garden Posts
              </Button>
            ) : null}
          </section>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                me={me ?? null}
                onDeleted={(deletedId) => {
                  setPosts((prev) => prev.filter((p) => p.id !== deletedId));
                }}
                onPostUpdated={(updated) => {
                  setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
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
