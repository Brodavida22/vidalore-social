import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, TrendingUp, UserCheck, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { communityProfilesQuery, type Profile } from "@/services/profiles";
import { getStoredRelationships, toggleFollow } from "@/services/social";

const TRENDING_TOPICS = [
  { tag: "DesignSystems", category: "Technology" },
  { tag: "Architecture", category: "Creative" },
  { tag: "Photography", category: "Art" },
  { tag: "Culture", category: "Community" },
  { tag: "VidaloreStyle", category: "Fashion" },
];

export function RightSidebar({ me }: { me?: Profile | null | undefined }) {
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

  const creators = (dbProfiles ?? []).filter((p) => p.id !== me?.id).slice(0, 4);

  function handleFollowToggle(targetId?: string) {
    if (!targetId) return;
    const isNowFollowing = toggleFollow(targetId);
    setFollowingMap((prev) => ({ ...prev, [targetId]: isNowFollowing }));
  }

  return (
    <aside className="hidden xl:block w-80 space-y-4 p-5 shrink-0">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search creators & topics..."
          className="h-10 rounded-lg bg-secondary pl-10 text-xs border-border focus-visible:ring-primary"
        />
      </div>

      {/* Suggested People Widget */}
      <section className="rounded-xl p-4 border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            Suggested People
          </h2>
          <Link to="/explore" className="text-xs text-[#E91E63] font-medium hover:underline">
            View all
          </Link>
        </div>

        {creators.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            Suggested people will appear here as users join.
          </p>
        ) : (
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
                      className="h-8 w-8 text-xs ring-1 ring-border group-hover:ring-[#E91E63] transition-all shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground group-hover:text-[#E91E63] transition-colors truncate">
                        {c.display_name || `@${c.username}`}
                      </p>
                      <p className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                        <Sparkles className="h-2.5 w-2.5 text-[#E91E63]" />
                        <span>{c.points_balance ?? 100} pts</span>
                      </p>
                    </div>
                  </Link>

                  <Button
                    type="button"
                    size="sm"
                    variant={isFollowing ? "outline" : "default"}
                    onClick={() => handleFollowToggle(c.id)}
                    className={`h-7 px-2.5 rounded-lg text-[0.7rem] font-medium transition-all shrink-0 ${
                      isFollowing
                        ? "border-border text-foreground hover:bg-secondary"
                        : "bg-[#E91E63] text-white hover:bg-[#C2185B]"
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
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Trending Topics Widget */}
      <section className="rounded-xl p-4 border border-border bg-card shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-[#E91E63]" />
          Trending Topics
        </h2>
        <div className="space-y-2">
          {TRENDING_TOPICS.map((t) => (
            <div
              key={t.tag}
              className="group flex items-center justify-between rounded-lg p-2 hover:bg-secondary transition-colors cursor-pointer"
            >
              <div>
                <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  {t.category}
                </p>
                <p className="text-xs font-medium text-foreground group-hover:text-[#E91E63] transition-colors">
                  #{t.tag}
                </p>
              </div>
              <span className="text-[0.65rem] font-semibold text-[#E91E63] px-2 py-0.5 rounded bg-[#E91E63]/10">
                Trending
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Rewards Card */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-[#E91E63]" />
            VIDALORE Rewards
          </p>
          <h3 className="mt-1 font-display text-sm font-semibold text-foreground">
            Earn Activity Points
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Create quality posts, engage with discussions, and earn activity achievements.
          </p>
          <Button
            asChild
            size="sm"
            className="mt-3 h-8 text-xs font-medium rounded-lg bg-[#E91E63] hover:bg-[#C2185B] text-white"
          >
            <Link to="/points">View Activity</Link>
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
        <p>© 2026 VIDALORE SOCIAL. All rights reserved.</p>
      </div>
    </aside>
  );
}
