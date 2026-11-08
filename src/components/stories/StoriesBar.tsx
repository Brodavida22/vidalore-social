import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { StoryViewerModal } from "@/components/stories/StoryViewerModal";
import { StoryComposerModal } from "@/components/stories/StoryComposerModal";
import { getStoredStories, type StoryItem, type UserStoryGroup } from "@/services/reelsAndStories";
import type { Profile } from "@/services/profiles";

const FEATURED_CREATORS: Record<
  string,
  { username: string; displayName: string; avatarUrl: string }
> = {
  "creator-celeste": {
    username: "celeste",
    displayName: "Celeste Moreau",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80",
  },
  "creator-raphael": {
    username: "raphael",
    displayName: "Raphaël Vance",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
  },
  "creator-seraphina": {
    username: "seraphina",
    displayName: "Seraphina Lin",
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80",
  },
};

export function StoriesBar({ me }: { me?: Profile | null }) {
  const [stories, setStories] = useState<StoryItem[]>(() => getStoredStories());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);

  function reloadStories() {
    setStories(getStoredStories());
  }

  useEffect(() => {
    const handleUpdate = () => reloadStories();
    window.addEventListener("vidalore:reels-updated", handleUpdate);
    return () => window.removeEventListener("vidalore:reels-updated", handleUpdate);
  }, []);

  // Group stories by userId and filter only active 24-hour stories
  const now = Date.now();
  const validStories = stories.filter((s) => new Date(s.expiresAt).getTime() > now);

  const groupMap: Record<string, StoryItem[]> = {};
  validStories.forEach((s) => {
    if (!groupMap[s.userId]) groupMap[s.userId] = [];
    groupMap[s.userId]!.push(s);
  });

  const storyGroups: UserStoryGroup[] = Object.entries(groupMap).map(([userId, userStories]) => {
    const creatorInfo = FEATURED_CREATORS[userId] || {
      username: me?.id === userId ? me.username : "gardener",
      displayName: me?.id === userId ? me.display_name || me.username : "Garden Member",
      avatarUrl: me?.id === userId ? me.avatar_url : null,
    };

    const hasUnseen = me ? userStories.some((s) => !s.seenBy.includes(me.id)) : true;

    return {
      userId,
      username: creatorInfo.username,
      displayName: creatorInfo.displayName,
      avatarUrl: creatorInfo.avatarUrl,
      stories: userStories,
      hasUnseen,
    };
  });

  // My story group if I have posted
  const myStoryGroup = me ? storyGroups.find((g) => g.userId === me.id) : null;
  const otherGroups = storyGroups.filter((g) => g.userId !== me?.id);

  function openGroup(index: number) {
    setSelectedGroupIndex(index);
    setViewerOpen(true);
  }

  return (
    <section className="glass rounded-3xl p-3 sm:p-4 border border-border/80 shadow-card">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <p className="text-[0.7rem] uppercase tracking-wider text-rose-soft font-semibold">
          24h Garden Stories 🌹
        </p>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="text-xs text-rose-soft hover:underline font-medium"
        >
          + Add Story
        </button>
      </div>

      <div className="flex items-center gap-3.5 overflow-x-auto pb-1 scrollbar-none">
        {/* User Story Circle */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div
            className="relative cursor-pointer group"
            onClick={() => {
              if (myStoryGroup && myStoryGroup.stories.length > 0) {
                const idx = storyGroups.findIndex((g) => g.userId === me?.id);
                openGroup(idx !== -1 ? idx : 0);
              } else {
                setComposerOpen(true);
              }
            }}
          >
            <div
              className={`p-0.5 rounded-full transition-transform group-hover:scale-105 ${
                myStoryGroup && myStoryGroup.stories.length > 0
                  ? myStoryGroup.hasUnseen
                    ? "bg-gradient-rose shadow-glow"
                    : "ring-2 ring-muted-foreground/40"
                  : ""
              }`}
            >
              <UserAvatar
                profile={
                  me || {
                    username: "member",
                    display_name: "You",
                    avatar_url: null,
                  }
                }
                className="h-14 w-14 ring-2 ring-background"
              />
            </div>

            {/* Glowing Plus Icon */}
            {(!myStoryGroup || myStoryGroup.stories.length === 0) && (
              <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-rose text-white shadow-glow border border-background">
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
              </span>
            )}
          </div>
          <span className="text-[0.65rem] text-muted-foreground group-hover:text-foreground">
            {myStoryGroup ? "Your Story" : "Add Story"}
          </span>
        </div>

        {/* Featured / Circle Story Groups */}
        {otherGroups.map((group) => {
          const groupIdx = storyGroups.findIndex((g) => g.userId === group.userId);
          return (
            <div
              key={group.userId}
              onClick={() => openGroup(groupIdx)}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
            >
              <div
                className={`p-0.5 rounded-full transition-transform group-hover:scale-105 ${
                  group.hasUnseen
                    ? "bg-gradient-rose shadow-glow ring-2 ring-primary/40"
                    : "ring-2 ring-border/80"
                }`}
              >
                <UserAvatar
                  profile={{
                    avatar_url: group.avatarUrl,
                    username: group.username,
                    display_name: group.displayName,
                  }}
                  className="h-14 w-14 ring-2 ring-background"
                />
              </div>
              <span className="text-[0.65rem] text-muted-foreground group-hover:text-foreground truncate max-w-[62px]">
                {group.displayName.split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Story Viewer Modal */}
      <StoryViewerModal
        storyGroups={storyGroups}
        initialGroupIndex={selectedGroupIndex}
        open={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          reloadStories();
        }}
        me={me}
      />

      {/* Story Composer Modal */}
      <StoryComposerModal
        open={composerOpen}
        onOpenChange={setComposerOpen}
        me={me}
        onStoryPublished={reloadStories}
      />
    </section>
  );
}
