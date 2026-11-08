import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, TrendingUp, UserCheck, UserPlus, Compass } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { communityProfilesQuery, type Profile } from "@/services/profiles";
import { getStoredRelationships, toggleFollow } from "@/services/social";

const TRENDING_TOPICS = [
  { tag: "RoseGarden", posts: "2.4k moments", category: "Community" },
  { tag: "VelvetHours", posts: "1.8k moments", category: "Aesthetic" },
  { tag: "MidnightBloom", posts: "940 moments", category: "Nightlife" },
  { tag: "VidaloreStyle", posts: "720 moments", category: "Fashion" },
  { tag: "PoetryInDark", posts: "530 moments", category: "Writing" },
];

const FALLBACK_CREATORS: Partial<Profile>[] = [
  {
    id: "creator-celeste",
    username: "celeste",
    display_name: "Celeste Moreau",
    avatar_url:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80",
    points_balance: 1420,
    bio: "Curator of night-blooming gardens and velvet shadows 🌹",
  },
  {
    id: "creator-raphael",
    username: "raphael",
    display_name: "Raphaël Vance",
    avatar_url:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
    points_balance: 980,
    bio: "Visual director & architectural photography.",
  },
  {
    id: "creator-seraphina",
    username: "seraphina",
    display_name: "Seraphina Lin",
    avatar_url:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80",
    points_balance: 630,
    bio: "Acoustic strings & dark ambient audio.",
  },
];

export function RightSidebar({ me }: { me?: Profile | null }) {
  const [search, setSearch] = useState("");
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>(() => {
    const rel = getStoredRelationships();
    const map: Record<string, boolean> = {};
    rel.following.forEach((id) => {
      map[id] = true;
    });
    return map;
  });

  const { data: dbProfiles } = useQuery(communityProfilesQuery(6));

  // Merge real database profiles (excluding self) with rich fallback creators
  const creators = (dbProfiles && dbProfiles.length > 0 ? dbProfiles : FALLBACK_CREATORS)
    .filter((p) => p.id !== me?.id)
    .slice(0, 4);

  function handleFollowToggle(targetId?: string) {
    if (!targetId) return;
    const isNowFollowing = toggleFollow(targetId);
    setFollowingMap((prev) => ({ ...prev, [targetId]: isNowFollowing }));
  }

  return (
    <aside className="hidden xl:block w-80 space-y-5 p-5 shrink-0">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search garden & creators..."
          className="h-11 rounded-2xl bg-secondary/60 pl-10 text-xs border-border/60 focus-visible:ring-primary"
        />
      </div>

      {/* Suggested Creators Widget */}
      <section className="glass rounded-3xl p-4 border border-border/80 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Suggested Gardeners
          </h2>
          <Link to="/explore" className="text-xs text-rose-soft hover:underline">
            View all
          </Link>
        </div>

        <div className="space-y-3">
          {creators.map((c) => {
            if (!c.username) return null;
            const isFollowing = c.id ? !!followingMap[c.id] : false;
            return (
              <div key={c.id || c.username} className="flex items-center justify-between gap-2.5">
                <Link
                  to="/u/$username"
                  params={{ username: c.username }}
                  className="flex items-center gap-2.5 min-w-0 group"
                >
                  <UserAvatar
                    profile={{
                      avatar_url: c.avatar_url ?? null,
                      username: c.username,
                      display_name: c.display_name ?? null,
                    }}
                    className="h-9 w-9 text-xs ring-1 ring-primary/30 group-hover:ring-primary transition-all shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground group-hover:text-rose-soft transition-colors truncate">
                      {c.display_name || `@${c.username}`}
                    </p>
                    <p className="text-[0.65rem] text-rose-soft">
                      🌹 {c.points_balance ?? 100} pts
                    </p>
                  </div>
                </Link>

                <Button
                  type="button"
                  size="sm"
                  variant={isFollowing ? "glass" : "rose"}
                  onClick={() => handleFollowToggle(c.id)}
                  className="h-7 px-2.5 rounded-full text-[0.7rem] font-semibold transition-all shrink-0"
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
              </div>
            );
          })}
        </div>
      </section>

      {/* Trending Topics Widget */}
      <section className="glass rounded-3xl p-4 border border-border/80 shadow-card">
        <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          Blooming in the Garden
        </h2>
        <div className="space-y-2.5">
          {TRENDING_TOPICS.map((t) => (
            <div
              key={t.tag}
              className="group flex items-center justify-between rounded-2xl p-2 hover:bg-secondary/50 transition-colors cursor-pointer"
            >
              <div>
                <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  {t.category}
                </p>
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  #{t.tag}
                </p>
              </div>
              <span className="text-[0.7rem] text-muted-foreground">{t.posts}</span>
            </div>
          ))}
        </div>
      </section>

      {/* VIDA Points Perks card */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-rose p-4 text-primary-foreground shadow-glow">
        <div className="relative z-10">
          <p className="text-[0.65rem] uppercase tracking-widest opacity-85">Daily Rewards</p>
          <h3 className="mt-1 font-display text-xl font-bold">Earn VIDA POINTS 🌹</h3>
          <p className="mt-1 text-xs opacity-90 leading-relaxed">
            Share moments, inspire other gardeners, and unlock exclusive garden badges.
          </p>
          <Button
            asChild
            variant="glass"
            size="sm"
            className="mt-3 h-8 text-xs font-semibold rounded-full bg-white/20 hover:bg-white/30 border-white/20 text-white"
          >
            <Link to="/points">View Rewards</Link>
          </Button>
        </div>
      </section>

      {/* Footer Info */}
      <div className="px-2 text-[0.7rem] text-muted-foreground space-y-1">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <Link to="/explore" className="hover:underline">
            Explore
          </Link>
          <span>·</span>
          <Link to="/points" className="hover:underline">
            Points
          </Link>
          <span>·</span>
          <Link to="/settings/profile" className="hover:underline">
            Settings
          </Link>
        </div>
        <p>© 2026 VIDALORE SOCIAL. Connect. Express. Play. Belong. 🌹</p>
      </div>
    </aside>
  );
}
