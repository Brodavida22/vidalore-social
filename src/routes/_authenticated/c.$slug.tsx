import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Users,
  Globe,
  Lock,
  Send,
  Loader2,
  CalendarDays,
  LogIn,
  LogOut,
  MessageSquare,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  getCommunityBySlug,
  isCommunityMember,
  getCommunityMembers,
  getCommunityPosts,
  joinCommunity,
  leaveCommunity,
  createCommunityPost,
} from "@/services/communities";

export const Route = createFileRoute("/_authenticated/c/$slug")({
  component: CommunityDetailPage,
});

function CommunityDetailPage() {
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();
  const [postContent, setPostContent] = useState("");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const communityQuery = useQuery({
    queryKey: ["community", slug],
    queryFn: () => getCommunityBySlug(slug),
  });

  const community = communityQuery.data;

  const membershipQuery = useQuery({
    queryKey: ["community-membership", community?.id],
    queryFn: () => isCommunityMember(community!.id),
    enabled: !!community,
  });

  const membersQuery = useQuery({
    queryKey: ["community-members", community?.id],
    queryFn: () => getCommunityMembers(community!.id),
    enabled: !!community,
  });

  const postsQuery = useQuery({
    queryKey: ["community-posts", community?.id],
    queryFn: () => getCommunityPosts(community!.id),
    enabled: !!community,
  });

  const joined = membershipQuery.data === true;

  const refreshCommunity = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["community", slug],
      }),
      queryClient.invalidateQueries({
        queryKey: ["community-membership", community?.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["community-members", community?.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["community-posts", community?.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["my-communities"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["communities"],
      }),
    ]);
  };

  const joinMutation = useMutation({
    mutationFn: () => joinCommunity(community!.id),
    onSuccess: async () => {
      await refreshCommunity();
      toast.success(`Joined ${community?.name ?? "community"}!`);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Could not join community. Please try again.",
      );
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveCommunity(community!.id),
    onSuccess: async () => {
      setLeaveConfirmOpen(false);
      await refreshCommunity();
      toast.info(`You left ${community?.name ?? "this community"}.`);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Could not leave community. Please try again.",
      );
    },
  });

  const postMutation = useMutation({
    mutationFn: () =>
      createCommunityPost({ communityId: community!.id, content: postContent.trim() }),
    onSuccess: async () => {
      setPostContent("");
      await queryClient.invalidateQueries({
        queryKey: ["community-posts", community?.id],
      });
      toast.success("Post published to the community!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Your post could not be published.");
    },
  });

  if (communityQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#E91E63]" />
        Loading community...
      </div>
    );
  }

  if (communityQuery.isError || !community) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <Link
          to="/communities"
          className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Communities
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 text-center">
          <h2 className="text-xl font-bold text-foreground">Community not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This community may have been deleted or you may not have access.
          </p>
        </div>
      </div>
    );
  }

  const members = membersQuery.data ?? [];
  const posts = postsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6 pb-20">
      <Link
        to="/communities"
        className="inline-flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Communities
      </Link>

      {/* Community Header */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="relative h-40 bg-gradient-to-br from-[#E91E63]/30 via-card to-[#E91E63]/10 md:h-56">
          {community.cover_url && (
            <img src={community.cover_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>

        <div className="p-4 sm:p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              {community.avatar_url ? (
                <img
                  src={community.avatar_url}
                  alt={community.name}
                  className="-mt-12 h-20 w-20 shrink-0 rounded-2xl border-4 border-card object-cover bg-card"
                />
              ) : (
                <div className="-mt-12 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-card bg-[#E91E63] text-3xl font-bold text-white shadow-sm">
                  {community.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground md:text-3xl truncate">
                  {community.name}
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">/c/{community.slug}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {members.length} members
                  </span>

                  <span className="flex items-center gap-1.5">
                    {community.privacy === "private" ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    {community.privacy === "private" ? "Private" : "Public"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!membershipQuery.isLoading &&
                (joined ? (
                  <button
                    type="button"
                    onClick={() => setLeaveConfirmOpen(true)}
                    disabled={leaveMutation.isPending}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
                  >
                    {leaveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    Leave Community
                  </button>
                ) : community.privacy === "public" ? (
                  <button
                    type="button"
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E91E63] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C2185B] disabled:opacity-50"
                  >
                    {joinMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogIn className="h-4 w-4" />
                    )}
                    Join Community
                  </button>
                ) : (
                  <span className="inline-flex min-h-[44px] items-center rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground">
                    Private community
                  </span>
                ))}
            </div>
          </div>

          {community.description && (
            <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-foreground/90">
              {community.description}
            </p>
          )}
        </div>
      </section>

      {/* Leave confirmation dialog */}
      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {community.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You can rejoin anytime if this community is public. Private communities require an
              invitation to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaveMutation.isPending ? "Leaving..." : "Leave community"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Community Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5 min-w-0">
          {/* Create Post */}
          {joined && (
            <section className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-foreground">Share with the community</h2>

              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
                maxLength={5000}
                className="w-full resize-none rounded-xl border border-border bg-secondary/50 p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#E91E63]"
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => postMutation.mutate()}
                  disabled={!postContent.trim() || postMutation.isPending}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C2185B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {postMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Publish
                </button>
              </div>
            </section>
          )}

          {/* Posts Feed */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Community Feed</h2>
              <span className="text-sm text-muted-foreground">{posts.length} posts</span>
            </div>

            {postsQuery.isLoading ? (
              <div className="flex justify-center rounded-2xl border border-border bg-card p-10 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#E91E63]" />
                Loading posts...
              </div>
            ) : postsQuery.isError ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-center">
                <p className="text-sm text-destructive">Could not load community posts.</p>
                <button
                  type="button"
                  onClick={() => postsQuery.refetch()}
                  className="mt-3 min-h-[44px] px-3 text-sm font-medium text-[#E91E63] hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">No posts yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Be the first to share something with this community.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E91E63]/15 text-sm font-bold text-[#E91E63]">
                        M
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">Community member</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          {new Date(post.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {post.content && (
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                        {post.content}
                      </p>
                    )}

                    {post.media_url &&
                      (post.media_type === "video" ? (
                        <video
                          src={post.media_url}
                          controls
                          playsInline
                          preload="metadata"
                          className="mt-3 max-h-[500px] w-full rounded-xl bg-black"
                        />
                      ) : (
                        <img
                          src={post.media_url}
                          alt="Community post media"
                          loading="lazy"
                          className="mt-3 max-h-[500px] w-full rounded-xl object-contain"
                        />
                      ))}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Members Sidebar */}
        <aside className="h-fit rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Members</h2>
            <span className="text-xs text-muted-foreground">{members.length}</span>
          </div>

          {membersQuery.isLoading ? (
            <div className="flex items-center justify-center py-5 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#E91E63]" />
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No members found.</p>
          ) : (
            <div className="space-y-3">
              {members.slice(0, 15).map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                    {member.user_id.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      Member {member.user_id.slice(0, 8)}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {members.length > 15 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Showing 15 of {members.length} members
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
