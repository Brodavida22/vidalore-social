import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, UserPen, Flame, Users, Compass, RefreshCw, Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PostComposer } from "@/components/feed/PostComposer";
import { PostCard } from "@/components/feed/PostCard";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { myProfileQuery } from "@/services/profiles";
import {
  getStoredPosts,
  getStoredRelationships,
  getStoredNotifications,
  type SocialPost,
} from "@/services/social";
import { NotificationsModal } from "@/components/social/NotificationsModal";

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
  const { data: me, isLoading: profileLoading } = useQuery(myProfileQuery());

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [feedFilter, setFeedFilter] = useState<"for-you" | "following" | "trending">("for-you");
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
    }, 150);
  }, [feedFilter, me?.id]);

  useEffect(() => {
    reloadPosts();
    const handleUpdate = () => reloadPosts();
    window.addEventListener("vidalore:social-updated", handleUpdate);
    return () => window.removeEventListener("vidalore:social-updated", handleUpdate);
  }, [reloadPosts]);

  useEffect(() => {
    const notifs = getStoredNotifications();
    setUnreadCount(notifs.filter((n) => !n.isRead).length);
  }, []);

  const complete = me && me.avatar_url && me.display_name && me.bio;

  return (
    <div className="flex justify-center mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
      {/* Central feed column */}
      <div className="w-full max-w-2xl min-w-0 space-y-4 py-3 sm:py-5">
        {/* 1. Top Header Bar for Feed */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display font-black text-xl sm:text-2xl tracking-tight text-foreground">
              VIDA<span className="text-[#E91E63]">LORE</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              to="/explore"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#E91E63] ring-2 ring-background" />
              )}
            </button>
          </div>
        </div>

        {/* 2. Stories Section */}
        <StoriesBar me={me} />

        {/* 3. Create Post / Composer Section */}
        {me && <PostComposer me={me} onPostCreated={reloadPosts} />}

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
            onClick={reloadPosts}
            title="Refresh feed"
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingPosts ? "animate-spin text-[#E91E63]" : ""}`}
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

      {/* Notifications Modal */}
      <NotificationsModal
        open={notifOpen}
        onOpenChange={(v) => {
          setNotifOpen(v);
          const notifs = getStoredNotifications();
          setUnreadCount(notifs.filter((n) => !n.isRead).length);
        }}
      />
    </div>
  );
}
