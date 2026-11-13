import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  Plus,
  Globe,
  Lock,
  Loader2,
  Sparkles,
  Compass,
  Check,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useAndroidBackNavigation } from "@/lib/useAndroidBackNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  createCommunity,
  getCommunities,
  getMyCommunities,
  joinCommunity,
  leaveCommunity,
  type Community,
} from "@/services/communities";

export const Route = createFileRoute("/_authenticated/communities")({
  head: () => ({
    meta: [
      { title: "Communities — VIDALORE SOCIAL" },
      {
        name: "description",
        content: "Discover communities and connect with people.",
      },
    ],
  }),
  component: CommunitiesPage,
});

type CommunityTab = "discover" | "mine";

function CommunitiesPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<CommunityTab>("discover");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pendingCommunity, setPendingCommunity] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [creating, setCreating] = useState(false);

  useAndroidBackNavigation(
    showCreate && !creating,
    () => setShowCreate(false),
    "createCommunityModal",
  );

  const {
    data: communities = [],
    isLoading: communitiesLoading,
    isError: communitiesError,
    refetch: refetchCommunities,
  } = useQuery({
    queryKey: ["communities"],
    queryFn: getCommunities,
  });

  const {
    data: myCommunities = [],
    isLoading: mineLoading,
    refetch: refetchMine,
  } = useQuery({
    queryKey: ["my-communities"],
    queryFn: getMyCommunities,
  });

  const myCommunityIds = useMemo(
    () => new Set(myCommunities.map((community) => community.id)),
    [myCommunities],
  );

  const filteredCommunities = useMemo(() => {
    const source =
      activeTab === "mine"
        ? communities.filter((community) => myCommunityIds.has(community.id))
        : communities;

    const term = search.trim().toLowerCase();

    if (!term) return source;

    return source.filter(
      (community) =>
        community.name.toLowerCase().includes(term) ||
        community.description?.toLowerCase().includes(term) ||
        community.slug.toLowerCase().includes(term),
    );
  }, [communities, activeTab, search, myCommunityIds]);

  function invalidateCommunityQueries() {
    queryClient.invalidateQueries({ queryKey: ["communities"] });
    queryClient.invalidateQueries({ queryKey: ["my-communities"] });
  }

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleCreateCommunity(event: React.FormEvent) {
    event.preventDefault();

    if (name.trim().length < 3) {
      toast.error("Community name must be at least 3 characters.");
      return;
    }

    setCreating(true);

    try {
      await createCommunity({
        name: name.trim(),
        slug: slug.trim() || generateSlug(name),
        description: description.trim(),
        privacy,
      });

      toast.success("Community created successfully!");
      setShowCreate(false);
      setName("");
      setSlug("");
      setDescription("");
      setPrivacy("public");

      invalidateCommunityQueries();
      await refetchMine();
      setActiveTab("mine");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create community.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(community: Community) {
    setPendingCommunity(community.id);

    try {
      await joinCommunity(community.id);
      toast.success(`Joined ${community.name}!`);
      invalidateCommunityQueries();
      await refetchMine();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to join community.");
    } finally {
      setPendingCommunity(null);
    }
  }

  async function handleLeave(community: Community) {
    setPendingCommunity(community.id);

    try {
      await leaveCommunity(community.id);
      toast.success(`You left ${community.name}.`);
      invalidateCommunityQueries();
      await refetchMine();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to leave community.");
    } finally {
      setPendingCommunity(null);
    }
  }

  const loading = activeTab === "mine" ? mineLoading : communitiesLoading;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            VIDALORE SOCIAL
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Communities</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Find your people. Share ideas. Build something together.
          </p>
        </div>

        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create community
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search communities..."
          className="h-11 border-border bg-card pl-10"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button
          variant={activeTab === "discover" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("discover")}
          className="gap-2"
        >
          <Compass className="h-4 w-4" />
          Discover
        </Button>

        <Button
          variant={activeTab === "mine" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("mine")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          My communities
        </Button>
      </div>

      {/* Community grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : communitiesError && activeTab === "discover" ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">We couldn't load communities right now.</p>
          <Button variant="outline" className="mt-4" onClick={() => refetchCommunities()}>
            Try again
          </Button>
        </div>
      ) : filteredCommunities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>

          <h3 className="text-lg font-semibold text-foreground">
            {search
              ? "No communities found"
              : activeTab === "mine"
                ? "You haven't joined any communities yet"
                : "No communities yet"}
          </h3>

          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {search
              ? "Try searching with another name or keyword."
              : activeTab === "mine"
                ? "Discover communities and join conversations that interest you."
                : "Be the first to create a community on VidAlore."}
          </p>

          {!search && (
            <Button
              className="mt-5 gap-2"
              onClick={() =>
                activeTab === "mine" ? setActiveTab("discover") : setShowCreate(true)
              }
            >
              {activeTab === "mine" ? (
                <>
                  <Compass className="h-4 w-4" />
                  Discover communities
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create community
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCommunities.map((community) => {
            const joined = myCommunityIds.has(community.id);
            const busy = pendingCommunity === community.id;

            return (
              <article
                key={community.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
              >
                {/* Cover */}
                <div className="relative h-24 bg-gradient-to-br from-primary/20 via-card to-primary/5">
                  {community.cover_url && (
                    <img src={community.cover_url} alt="" className="h-full w-full object-cover" />
                  )}

                  <div className="absolute right-3 top-3 rounded-full border border-border/50 bg-background/80 p-1.5 backdrop-blur">
                    {community.privacy === "private" ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Community details */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="-mt-10 mb-3">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-4 border-card bg-muted">
                      {community.avatar_url ? (
                        <img
                          src={community.avatar_url}
                          alt={community.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Users className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  <h3 className="line-clamp-1 text-lg font-semibold text-foreground">
                    {community.name}
                  </h3>

                  <p className="mt-1 text-xs text-muted-foreground">/{community.slug}</p>

                  <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-sm text-muted-foreground">
                    {community.description || "A community on VidAlore Social."}
                  </p>

                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {community.member_count} {community.member_count === 1 ? "member" : "members"}
                    </span>

                    <span className="rounded-full bg-muted px-2 py-1 capitalize">
                      {community.privacy}
                    </span>
                  </div>

                  <div className="mt-4">
                    {joined ? (
                      community.owner_id === community.owner_id && community.owner_id ? (
                        <Button variant="outline" size="sm" className="w-full gap-2" disabled>
                          <Check className="h-4 w-4" />
                          Joined
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          disabled={busy}
                          onClick={() => handleLeave(community)}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Leave community
                        </Button>
                      )
                    ) : (
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        disabled={busy || community.privacy === "private"}
                        onClick={() => handleJoin(community)}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        {community.privacy === "private" ? "Private community" : "Join community"}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create community modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-community-title"
            className="w-full max-w-lg max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-background p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-2">
              <div>
                <h2 id="create-community-title" className="text-xl font-bold text-foreground">
                  Create a community
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start a space for people who share your interests.
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                aria-label="Close modal"
                disabled={creating}
                onClick={() => setShowCreate(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateCommunity} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Community name</label>
                <Input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (!slug) setSlug(generateSlug(event.target.value));
                  }}
                  placeholder="e.g. Photography Lovers"
                  minLength={3}
                  maxLength={60}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Community URL</label>
                <div className="flex items-center rounded-md border border-input bg-muted/30 px-3">
                  <span className="text-sm text-muted-foreground">/c/</span>
                  <input
                    value={slug}
                    onChange={(event) => setSlug(generateSlug(event.target.value))}
                    placeholder="photography-lovers"
                    className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use lowercase letters, numbers, and hyphens.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What is this community about?"
                  maxLength={500}
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Privacy</label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrivacy("public")}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                      privacy === "public"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    <span className="text-sm font-medium">Public</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrivacy("private")}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                      privacy === "private"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <Lock className="h-4 w-4" />
                    <span className="text-sm font-medium">Private</span>
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {privacy === "public"
                    ? "Anyone can discover and join this community."
                    : "Private communities are hidden from discovery and require invitations to join."}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={creating}
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>

                <Button type="submit" className="flex-1 gap-2" disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {creating ? "Creating..." : "Create community"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
