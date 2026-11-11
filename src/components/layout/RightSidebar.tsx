import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { communityProfilesQuery, type Profile } from "@/services/profiles";
import {
  followUser,
  unfollowUser,
  isFollowing,
} from "@/services/relationships";

const TRENDING_TOPICS = [
  { tag: "DesignSystems", category: "Technology" },
  { tag: "Architecture", category: "Creative" },
  { tag: "Photography", category: "Art" },
  { tag: "Culture", category: "Community" },
  { tag: "VidaloreStyle", category: "Fashion" },
];

export function RightSidebar({
  me,
}: {
  me?: Profile | null | undefined;
}) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: dbProfiles = [] } = useQuery(
    communityProfilesQuery(6),
  );

  const creators = dbProfiles
    .filter((profile) => profile.id !== me?.id)
    .slice(0, 4);

  const followMutation = useMutation({
    mutationFn: async ({
      userId,
      following,
    }: {
      userId: string;
      following: boolean;
    }) => {
      if (following) {
        await unfollowUser(userId);
      } else {
        await followUser(userId);
      }
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["relationship"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["profiles"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["feed"],
      });
    },
  });

  return (
    <aside className="hidden xl:block w-80 space-y-4 p-5 shrink-0">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search creators & topics..."
          className="h-10 rounded-lg bg-secondary pl-10 text-xs border-border focus-visible:ring-primary"
        />
      </div>

      {/* Suggested People */}
      <section className="rounded-xl p-4 border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            Suggested People
          </h2>

          <Link
            to="/explore"
            className="text-xs text-[#E91E63] font-medium hover:underline"
          >
            View all
          </Link>
        </div>

        {creators.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            Suggested people will appear here as users join.
          </p>
        ) : (
          <div className="space-y-3">
            {creators.map((creator) => {
              if (!creator.username || !creator.id) {
                return null;
              }

              return (
                <SuggestedCreator
                  key={creator.id}
                  creator={creator}
                  disabled={!me?.id || me.id === creator.id}
                  onFollowToggle={(userId, following) =>
                    followMutation.mutate({
                      userId,
                      following,
                    })
                  }
                  pending={
                    followMutation.isPending &&
                    followMutation.variables?.userId === creator.id
                  }
                />
              );
            })}
          </div>
        )}

        {followMutation.isError && (
          <p className="mt-3 text-xs text-destructive">
            {followMutation.error instanceof Error
              ? followMutation.error.message
              : "Unable to update follow status."}
          </p>
        )}
      </section>

      {/* Trending Topics */}
      <section className="rounded-xl p-4 border border-border bg-card shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-[#E91E63]" />
          Trending Topics
        </h2>

        <div className="space-y-2">
          {TRENDING_TOPICS.map((topic) => (
            <div
              key={topic.tag}
              className="group flex items-center justify-between rounded-lg p-2 hover:bg-secondary transition-colors cursor-pointer"
            >
              <div>
                <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  {topic.category}
                </p>

                <p className="text-xs font-medium text-foreground group-hover:text-[#E91E63] transition-colors">
                  #{topic.tag}
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

      {/* Footer */}
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

function SuggestedCreator({
  creator,
  disabled,
  pending,
  onFollowToggle,
}: {
  creator: Profile;
  disabled: boolean;
  pending: boolean;
  onFollowToggle: (
    userId: string,
    following: boolean,
  ) => void;
}) {
  const { data: following = false, isLoading } = useQuery({
    queryKey: ["relationship", "following", creator.id],
    queryFn: () => isFollowing(creator.id),
    enabled: Boolean(creator.id),
    staleTime: 30_000,
  });

  return (
    <div className="flex items-center justify-between gap-2.5">
      <Link
        to="/u/$username"
        params={{ username: creator.username! }}
        className="flex items-center gap-2.5 min-w-0 group"
      >
        <UserAvatar
          profile={{
            avatar_url: creator.avatar_url ?? null,
            username: creator.username!,
            display_name: creator.display_name ?? null,
          }}
          className="h-8 w-8 text-xs ring-1 ring-border group-hover:ring-[#E91E63] transition-all shrink-0"
        />

        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground group-hover:text-[#E91E63] transition-colors truncate">
            {creator.display_name || `@${creator.username}`}
          </p>

          <p className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
            <Sparkles className="h-2.5 w-2.5 text-[#E91E63]" />
            <span>{creator.points_balance ?? 100} pts</span>
          </p>
        </div>
      </Link>

      <Button
        type="button"
        size="sm"
        variant={following ? "outline" : "default"}
        disabled={disabled || pending || isLoading}
        onClick={() => onFollowToggle(creator.id, following)}
        className={`h-7 px-2.5 rounded-lg text-[0.7rem] font-medium transition-all shrink-0 ${
          following
            ? "border-border text-foreground hover:bg-secondary"
            : "bg-[#E91E63] text-white hover:bg-[#C2185B]"
        }`}
      >
        {pending ? (
          "..."
        ) : following ? (
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
}
