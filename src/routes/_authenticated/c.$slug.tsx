
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
    onSuccess: refreshCommunity,
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveCommunity(community!.id),
    onSuccess: refreshCommunity,
  });

  const postMutation = useMutation({
    mutationFn: () =>
      createCommunityPost({ communityId: community!.id, content: postContent.trim() }),
    onSuccess: async () => {
      setPostContent("");
      await queryClient.invalidateQueries({
        queryKey: ["community-posts", community?.id],
      });
    },
  });

  if (communityQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading community...
      </div>
    );
  }

  if (communityQuery.isError || !community) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Link
          to="/communities"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Communities
        </Link>

        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-10 text-center">
          <h2 className="text-xl font-bold text-white">
            Community not found
          </h2>
          <p className="mt-2 text-zinc-400">
            This community may have been deleted or you may not have access.
          </p>
        </div>
      </div>
    );
  }

  const members = membersQuery.data ?? [];
  const posts = postsQuery.data ?? [];

  const isOwner =
    community.owner_id === community.owner_id &&
    membershipQuery.isSuccess &&
    joined;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <Link
        to="/communities"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Communities
      </Link>

      {/* Community Header */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
        <div className="relative h-40 bg-gradient-to-br from-violet-700/50 via-zinc-900 to-indigo-700/40 md:h-56">
          {community.cover_url && (
            <img
              src={community.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              {community.avatar_url ? (
                <img
                  src={community.avatar_url}
                  alt={community.name}
                  className="-mt-12 h-20 w-20 rounded-2xl border-4 border-zinc-900 object-cover"
                />
              ) : (
                <div className="-mt-12 flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-zinc-900 bg-violet-600 text-3xl font-bold text-white">
                  {community.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <h1 className="text-2xl font-bold text-white md:text-3xl">
                  {community.name}
                </h1>

                <p className="mt-1 text-sm text-zinc-400">
                  /c/{community.slug}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
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
                    onClick={() => {
                      if (
                        window.confirm(
                          "Are you sure you want to leave this community?"
                        )
                      ) {
                        leaveMutation.mutate();
                      }
                    }}
                    disabled={leaveMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
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
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                  >
                    {joinMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogIn className="h-4 w-4" />
                    )}
                    Join Community
                  </button>
                ) : (
                  <span className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-400">
                    Private community
                  </span>
                ))}
            </div>
          </div>

          {community.description && (
            <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-zinc-300">
              {community.description}
            </p>
          )}

          {joinMutation.isError && (
            <p className="mt-3 text-sm text-red-400">
              Could not join community. Please try again.
            </p>
          )}

          {leaveMutation.isError && (
            <p className="mt-3 text-sm text-red-400">
              Could not leave community. Please try again.
            </p>
          )}
        </div>
      </section>

      {/* Community Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {/* Create Post */}
          {joined && (
            <section className="rounded-2xl border border-white/10 bg-zinc-900 p-4 md:p-5">
              <h2 className="mb-3 font-semibold text-white">
                Share with the community
              </h2>

              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
                maxLength={5000}
                className="w-full resize-none rounded-xl border border-white/10 bg-zinc-950 p-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-500"
              />

              {postMutation.isError && (
                <p className="mt-2 text-sm text-red-400">
                  Your post could not be published.
                </p>
              )}

              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => postMutation.mutate()}
                  disabled={!postContent.trim() || postMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
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
              <h2 className="text-lg font-bold text-white">
                Community Feed
              </h2>
              <span className="text-sm text-zinc-500">
                {posts.length} posts
              </span>
            </div>

            {postsQuery.isLoading ? (
              <div className="flex justify-center rounded-2xl border border-white/10 bg-zinc-900 p-10 text-zinc-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading posts...
              </div>
            ) : postsQuery.isError ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center">
                <p className="text-sm text-red-400">
                  Could not load community posts.
                </p>
                <button
                  onClick={() => postsQuery.refetch()}
                  className="mt-3 text-sm text-violet-400 hover:text-violet-300"
                >
                  Try again
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-900 p-10 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
                <h3 className="font-semibold text-white">No posts yet</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Be the first to share something with this community.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-white/10 bg-zinc-900 p-4 md:p-5"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-300">
                        M
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Community member
                        </p>
                        <p className="flex items-center gap-1 text-xs text-zinc-500">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(post.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {post.content && (
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">
                        {post.content}
                      </p>
                    )}

                    {post.media_url && (
                      post.media_type === "video" ? (
                        <video
                          src={post.media_url}
                          controls
                          className="mt-3 max-h-[500px] w-full rounded-xl bg-black"
                        />
                      ) : (
                        <img
                          src={post.media_url}
                          alt="Community post media"
                          className="mt-3 max-h-[500px] w-full rounded-xl object-contain"
                        />
                      )
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Members Sidebar */}
        <aside className="h-fit rounded-2xl border border-white/10 bg-zinc-900 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Members</h2>
            <span className="text-xs text-zinc-500">
              {members.length}
            </span>
          </div>

          {membersQuery.isLoading ? (
            <div className="flex items-center justify-center py-5 text-sm text-zinc-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">
              No members found.
            </p>
          ) : (
            <div className="space-y-3">
              {members.slice(0, 15).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                    {member.user_id.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">
                      Member {member.user_id.slice(0, 8)}
                    </p>
                    <p className="text-xs capitalize text-zinc-500">
                      {member.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {members.length > 15 && (
            <p className="mt-3 text-center text-xs text-zinc-500">
              Showing 15 of {members.length} members
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
