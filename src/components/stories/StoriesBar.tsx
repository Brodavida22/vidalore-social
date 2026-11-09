import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { StoryViewerModal } from "@/components/stories/StoryViewerModal";
import { StoryComposerModal } from "@/components/stories/StoryComposerModal";
import { getStoryGroups, type UserStoryGroup } from "@/services/reelsAndStories";
import type { Profile } from "@/services/profiles";

export function StoriesBar({ me }: { me?: Profile | null }) {
  const [storyGroups, setStoryGroups] = useState<UserStoryGroup[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);

  const reloadStories = useCallback(async () => {
    try {
      setStoryGroups(await getStoryGroups(me?.id));
    } catch (error) {
      console.error("Failed to load stories", error);
    }
  }, [me?.id]);

  useEffect(() => {
    void reloadStories();
  }, [reloadStories]);

  useEffect(() => {
    const handleUpdate = () => {
      void reloadStories();
    };
    window.addEventListener("vidalore:reels-updated", handleUpdate);
    return () => window.removeEventListener("vidalore:reels-updated", handleUpdate);
  }, [reloadStories]);

  const myStoryGroup = me ? storyGroups.find((g) => g.userId === me.id) : null;
  const otherGroups = storyGroups.filter((g) => g.userId !== me?.id);

  function openGroup(index: number) {
    setSelectedGroupIndex(index);
    setViewerOpen(true);
  }

  return (
    <section className="rounded-xl p-3 sm:p-4 border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          24h Stories
        </p>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="text-xs text-primary hover:underline font-medium"
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
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "ring-2 ring-border"
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
                className="h-13 w-13 ring-1 ring-border"
              />
            </div>

            {/* Plus Icon */}
            {(!myStoryGroup || myStoryGroup.stories.length === 0) && (
              <span className="absolute bottom-0 right-0 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-background shadow-sm">
                <Plus className="h-3 w-3 stroke-[3]" />
              </span>
            )}
          </div>
          <span className="text-[0.65rem] text-muted-foreground group-hover:text-foreground">
            {myStoryGroup ? "Your Story" : "Add Story"}
          </span>
        </div>

        {/* Other Story Groups */}
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
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "ring-1 ring-border"
                }`}
              >
                <UserAvatar
                  profile={{
                    avatar_url: group.avatarUrl,
                    username: group.username,
                    display_name: group.displayName,
                  }}
                  className="h-13 w-13 ring-1 ring-border"
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
