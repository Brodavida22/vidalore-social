import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, FileText, Clapperboard, MessageSquare, Laugh } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  adminContentQuery,
  adminDeleteContentItem,
  adminKeys,
  type AdminPermissions,
} from "@/services/admin";
import { memeSubmissionsQuery, gamesKeys } from "@/services/games";

export function AdminContentSection({ permissions }: { permissions: AdminPermissions }) {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<"posts" | "reels" | "comments" | "memes">("posts");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: content, isLoading } = useQuery(adminContentQuery());
  const { data: memes = [] } = useQuery(memeSubmissionsQuery());

  const q = search.trim().toLowerCase();

  async function handleRemove(
    targetType: "post" | "reel" | "post_comment" | "reel_comment" | "meme",
    targetId: string,
  ) {
    setBusyId(targetId);
    try {
      await adminDeleteContentItem({
        targetType,
        targetId,
        reason: "Removed via VIDALORE Admin Content Console",
      });
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      await queryClient.invalidateQueries({ queryKey: gamesKeys.memes() });
      toast.success("Content removed and logged to audit trail.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove content.");
    } finally {
      setBusyId(null);
    }
  }

  const posts = (content?.posts ?? []).filter(
    (p) => !q || p.content.toLowerCase().includes(q) || p.authorUsername.toLowerCase().includes(q),
  );
  const reels = (content?.reels ?? []).filter(
    (r) =>
      !q ||
      (r.caption ?? "").toLowerCase().includes(q) ||
      r.creatorUsername.toLowerCase().includes(q),
  );
  const comments = (content?.comments ?? []).filter(
    (c) => !q || c.content.toLowerCase().includes(q) || c.authorUsername.toLowerCase().includes(q),
  );
  const filteredMemes = memes.filter(
    (m) =>
      !q ||
      m.topText.toLowerCase().includes(q) ||
      m.bottomText.toLowerCase().includes(q) ||
      m.authorUsername.toLowerCase().includes(q),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1 overflow-x-auto">
          {(
            [
              { id: "posts", label: `Posts (${posts.length})`, icon: FileText },
              { id: "reels", label: `Reels (${reels.length})`, icon: Clapperboard },
              { id: "comments", label: `Comments (${comments.length})`, icon: MessageSquare },
              { id: "memes", label: `Game Memes (${filteredMemes.length})`, icon: Laugh },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs whitespace-nowrap shrink-0 ${
                  subTab === tab.id
                    ? "bg-card text-[#E91E63] font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter content or author..."
            className="h-9 pl-8 text-xs bg-secondary"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {isLoading ? (
          <p className="p-8 text-center text-xs text-muted-foreground">
            Loading platform content...
          </p>
        ) : subTab === "posts" ? (
          posts.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">No posts found.</p>
          ) : (
            posts.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-4 p-4 text-xs">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">
                    @{p.authorUsername}{" "}
                    <span className="font-normal text-muted-foreground tabular-nums">
                      · {new Date(p.createdAt).toLocaleString()} · {p.likesCount} likes ·{" "}
                      {p.commentsCount} comments
                    </span>
                  </p>
                  <p className="text-muted-foreground break-words">
                    {p.content || "(Media-only post)"}
                  </p>
                </div>
                {permissions.canModerateContent && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busyId === p.id}
                    onClick={() => void handleRemove("post", p.id)}
                    className="h-7 text-[11px] px-2.5 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            ))
          )
        ) : subTab === "reels" ? (
          reels.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">No Reels found.</p>
          ) : (
            reels.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 p-4 text-xs">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">
                    @{r.creatorUsername}{" "}
                    <span className="font-normal text-muted-foreground tabular-nums">
                      · {r.viewsCount} views · {r.likesCount} likes · {r.commentsCount} comments
                    </span>
                  </p>
                  <p className="text-muted-foreground break-words">
                    {r.caption || "(No caption)"} {r.audioTitle ? `· Audio: ${r.audioTitle}` : ""}
                  </p>
                </div>
                {permissions.canModerateContent && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busyId === r.id}
                    onClick={() => void handleRemove("reel", r.id)}
                    className="h-7 text-[11px] px-2.5 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            ))
          )
        ) : subTab === "comments" ? (
          comments.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">No comments found.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-4 p-4 text-xs">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">
                    @{c.authorUsername}{" "}
                    <span className="font-normal text-muted-foreground tabular-nums">
                      · {c.source === "reel_comment" ? "Reel Comment" : "Post Comment"} ·{" "}
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="text-muted-foreground break-words">{c.content}</p>
                </div>
                {permissions.canModerateContent && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busyId === c.id}
                    onClick={() => void handleRemove(c.source, c.id)}
                    className="h-7 text-[11px] px-2.5 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            ))
          )
        ) : filteredMemes.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">
            No meme challenge submissions found.
          </p>
        ) : (
          filteredMemes.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-4 p-4 text-xs">
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-foreground">
                  @{m.authorUsername}{" "}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    · {m.votesCount} votes · Prompt: {m.prompt}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {m.topText} / {m.bottomText}
                </p>
              </div>
              {permissions.canModerateContent && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busyId === m.id}
                  onClick={() => void handleRemove("meme", m.id)}
                  className="h-7 text-[11px] px-2.5 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
