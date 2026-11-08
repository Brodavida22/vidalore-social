import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Search, Sparkles, TrendingUp, UserPlus, UserCheck, Grid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { PostCard } from "@/components/feed/PostCard";
import { myProfileQuery, communityProfilesQuery, type Profile } from "@/services/profiles";
import {
  getStoredPosts,
  getStoredRelationships,
  toggleFollow,
  type SocialPost,
} from "@/services/social";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({
    meta: [
      { title: "Explore the Garden — VIDALORE SOCIAL" },
      {
        name: "description",
        content: "Discover blooming creators, photography, and conversations.",
      },
      { property: "og:title", content: "Explore the Garden — VIDALORE SOCIAL" },
      { property: "og:description", content: "Discover blooming creators and moments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
});

const EXPLORE_CATEGORIES = [
  "All",
  "RoseGarden",
  "VelvetHours",
  "VidaloreStyle",
  "NightBloom",
  "Photography",
];

function ExplorePage() {
  const { data: me } = useQuery(myProfileQuery());
  const { data: dbProfiles } = useQuery(communityProfilesQuery(10));
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [rel, setRel] = useState(() => getStoredRelationships());

  const allPosts = getStoredPosts();

  function handleFollowToggle(targetId: string) {
    toggleFollow(targetId);
    setRel(getStoredRelationships());
  }

  // Filter posts based on category and search
  const filteredPosts = allPosts.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.content.toLowerCase().includes(search.toLowerCase()) ||
      p.authorName.toLowerCase().includes(search.toLowerCase()) ||
      p.authorUsername.toLowerCase().includes(search.toLowerCase()) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesCat = selectedCategory === "All" || (p.tags || []).includes(selectedCategory);

    return matchesSearch && matchesCat;
  });

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 py-6 space-y-6">
      {/* Header & Search */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
              <Compass className="h-6 w-6 text-primary" />
              Explore the Garden 🌹
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Discover inspiring creators, photography, and conversations.
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keywords, hashtags, or creators..."
            className="h-11 rounded-2xl bg-secondary/60 pl-10 text-xs border-border/70 focus-visible:ring-primary"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {EXPLORE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {cat === "All" ? "All Moments" : `#${cat}`}
            </button>
          ))}
        </div>
      </div>

      {/* Suggested Creators Carousel */}
      {dbProfiles && dbProfiles.length > 0 && (
        <section className="glass rounded-3xl p-4 border border-border/80 shadow-card">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs uppercase tracking-wider text-rose-soft font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Featured Gardeners
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {dbProfiles.slice(0, 4).map((c) => {
              const isFollowing = rel.following.includes(c.id);
              return (
                <div
                  key={c.id}
                  className="rounded-2xl bg-secondary/40 p-3 text-center flex flex-col items-center justify-between space-y-2 border border-border/40 hover:border-primary/30 transition-all"
                >
                  <Link to="/u/$username" params={{ username: c.username }}>
                    <UserAvatar
                      profile={c}
                      className="h-12 w-12 text-sm ring-1 ring-primary/40 mx-auto"
                    />
                    <p className="mt-2 text-xs font-semibold text-foreground truncate max-w-[120px]">
                      {c.display_name || c.username}
                    </p>
                    <p className="text-[0.65rem] text-rose-soft">🌹 {c.points_balance} pts</p>
                  </Link>

                  {me?.id !== c.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant={isFollowing ? "glass" : "rose"}
                      onClick={() => handleFollowToggle(c.id)}
                      className="h-7 w-full rounded-full text-[0.7rem] font-semibold"
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
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Explore Grid / Feed */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center space-y-2 border border-border/70">
            <span className="text-3xl">🥀</span>
            <p className="font-semibold text-foreground">No moments found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search or category filter.
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => <PostCard key={post.id} post={post} me={me ?? null} />)
        )}
      </div>
    </div>
  );
}
