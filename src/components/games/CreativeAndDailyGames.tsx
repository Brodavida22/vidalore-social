import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Laugh,
  Heart,
  Send,
  CalendarClock,
  CheckCircle2,
  Play,
  Gift,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { gameAudio } from "@/lib/gameAudio";
import {
  MEME_PROMPTS,
  MEME_TEMPLATES,
  memeSubmissionsQuery,
  dailyChallengesQuery,
  submitMemeEntry,
  voteMemeEntry,
  claimDailyChallenge,
  gamesKeys,
  type GameSlug,
  type MemeSubmission,
} from "@/services/games";

// ============================================================================
// 9. MEME CHALLENGE
// ============================================================================

export function MemeChallengeGame({
  myUserId,
  roomId,
  onFinishMatch,
}: {
  myUserId: string;
  roomId?: string | null;
  onFinishMatch: (result: {
    gameSlug: GameSlug;
    mode: "solo" | "ai" | "multiplayer";
    result: "win" | "loss" | "draw" | "completed";
    score: number;
    durationSeconds: number;
  }) => Promise<{ xpEarned: number; pointsEarned: number }>;
}) {
  const queryClient = useQueryClient();
  const { data: memes = [], isLoading } = useQuery(memeSubmissionsQuery());

  const [prompt, setPrompt] = useState(MEME_PROMPTS[0] ?? "When the group chat agrees on plans");
  const [templateId, setTemplateId] = useState(MEME_TEMPLATES[0]?.id ?? "neon-dark");
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeTemplate = MEME_TEMPLATES.find((t) => t.id === templateId) ?? MEME_TEMPLATES[0]!;

  async function handleSubmitMeme(e: React.FormEvent) {
    e.preventDefault();
    if (!topText.trim() && !bottomText.trim()) {
      toast.error("Write a top or bottom caption for your meme.");
      return;
    }

    setSubmitting(true);
    try {
      await submitMemeEntry({
        prompt,
        templateId,
        topText,
        bottomText,
        roomId: roomId ?? null,
      });
      setTopText("");
      setBottomText("");
      gameAudio.correct();
      await queryClient.invalidateQueries({ queryKey: gamesKeys.memes() });
      const reward = await onFinishMatch({
        gameSlug: "meme-challenge",
        mode: roomId ? "multiplayer" : "solo",
        result: "completed",
        score: 120,
        durationSeconds: 30,
      });
      toast.success(`Meme submitted! +${reward.xpEarned} XP · +${reward.pointsEarned} pts`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit meme.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(meme: MemeSubmission) {
    if (meme.userId === myUserId) {
      toast.error("You cannot vote for your own meme.");
      return;
    }
    if (meme.hasVoted) return;
    try {
      await voteMemeEntry(meme.id);
      gameAudio.move();
      await queryClient.invalidateQueries({ queryKey: gamesKeys.memes() });
      toast.success("Vote counted!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not vote.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meme Studio */}
        <form onSubmit={handleSubmitMeme} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Laugh className="h-4 w-4 text-[#E91E63]" />
              Meme Drop Studio
            </h3>
            <button
              type="button"
              onClick={() => {
                const next = MEME_PROMPTS[Math.floor(Math.random() * MEME_PROMPTS.length)];
                if (next) setPrompt(next);
              }}
              className="text-xs font-medium text-[#E91E63] hover:underline"
            >
              Shuffle Prompt
            </button>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-foreground">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
              Prompt
            </span>
            {prompt}
          </div>

          {/* Template Picker */}
          <div className="grid grid-cols-4 gap-2">
            {MEME_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={`rounded-lg border p-2 text-[11px] font-medium transition-all bg-gradient-to-br ${t.bg} ${t.text} ${
                  templateId === t.id
                    ? "ring-2 ring-[#E91E63] border-[#E91E63]"
                    : "border-border opacity-80"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Input
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              placeholder="TOP CAPTION..."
              maxLength={80}
              className="h-9 text-xs uppercase tracking-wide bg-secondary"
            />
            <Input
              value={bottomText}
              onChange={(e) => setBottomText(e.target.value)}
              placeholder="BOTTOM PUNCHLINE..."
              maxLength={80}
              className="h-9 text-xs uppercase tracking-wide bg-secondary"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-9 bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs font-semibold"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {submitting ? "Posting Meme..." : "Submit Meme to Vote"}
          </Button>
        </form>

        {/* Live Meme Preview */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live Card Preview
          </p>
          <div
            className={`flex min-h-[220px] flex-col justify-between rounded-xl border border-border bg-gradient-to-br p-5 text-center ${activeTemplate.bg} ${activeTemplate.text}`}
          >
            <p className="font-display text-base sm:text-lg font-extrabold uppercase tracking-wide break-words">
              {topText || "TOP CAPTION"}
            </p>
            <p className="text-[11px] opacity-75 italic px-3">{prompt}</p>
            <p className="font-display text-base sm:text-lg font-extrabold uppercase tracking-wide break-words">
              {bottomText || "BOTTOM PUNCHLINE"}
            </p>
          </div>
        </div>
      </div>

      {/* Community / Room Gallery */}
      <div className="border-t border-border pt-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-sm font-bold text-foreground">
            Submitted Memes ({memes.length})
          </h4>
          <span className="text-xs text-muted-foreground">Vote for the funniest drop</span>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground py-4">Loading meme gallery...</p>
        ) : memes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center rounded-xl border border-dashed border-border">
            No memes dropped yet. Be the first creator to submit one above!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {memes.map((meme) => {
              const tpl =
                MEME_TEMPLATES.find((t) => t.id === meme.templateId) ?? MEME_TEMPLATES[0]!;
              return (
                <div
                  key={meme.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-secondary/30 overflow-hidden"
                >
                  <div
                    className={`flex min-h-[150px] flex-col justify-between bg-gradient-to-br p-4 text-center ${tpl.bg} ${tpl.text}`}
                  >
                    <p className="font-display text-sm font-extrabold uppercase break-words">
                      {meme.topText}
                    </p>
                    <p className="text-[10px] opacity-75 line-clamp-2">{meme.prompt}</p>
                    <p className="font-display text-sm font-extrabold uppercase break-words">
                      {meme.bottomText}
                    </p>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserAvatar
                        profile={{
                          username: meme.authorUsername,
                          display_name: meme.authorDisplayName,
                          avatar_url: meme.authorAvatarUrl,
                        }}
                        className="h-5 w-5 text-[9px]"
                      />
                      <span className="truncate font-medium">@{meme.authorUsername}</span>
                    </div>

                    <button
                      type="button"
                      disabled={meme.hasVoted || meme.userId === myUserId}
                      onClick={() => void handleVote(meme)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
                        meme.hasVoted
                          ? "bg-[#E91E63] text-white"
                          : "bg-secondary hover:bg-[#E91E63]/15 text-foreground"
                      }`}
                    >
                      <Heart className={`h-3 w-3 ${meme.hasVoted ? "fill-white" : ""}`} />
                      {meme.votesCount}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 10. DAILY CHALLENGES
// ============================================================================

function getUtcCountdown(): string {
  const now = new Date();
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
  );
  const diffSec = Math.max(0, Math.floor((nextMidnight - now.getTime()) / 1000));
  const hrs = String(Math.floor(diffSec / 3600)).padStart(2, "0");
  const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, "0");
  const secs = String(diffSec % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

export function DailyChallengesPanel({ onLaunchGame }: { onLaunchGame: (slug: GameSlug) => void }) {
  const queryClient = useQueryClient();
  const { data: challenges = [], isLoading } = useQuery(dailyChallengesQuery());
  const [countdown, setCountdown] = useState(getUtcCountdown);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setCountdown(getUtcCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleClaim(id: string) {
    setClaimingId(id);
    try {
      const res = await claimDailyChallenge(id);
      gameAudio.win();
      await queryClient.invalidateQueries({ queryKey: gamesKeys.all });
      toast.success(`Daily reward claimed! +${res.xp} XP · +${res.points} VIDA Points`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not claim reward.");
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#E91E63]" />
            Today&apos;s Missions
          </h3>
          <p className="text-xs text-muted-foreground">
            Complete challenges in any featured mode to earn bonus XP and VIDA Points.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-mono tabular-nums">
          <CalendarClock className="h-3.5 w-3.5 text-[#E91E63]" />
          <span>Resets in {countdown}</span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4">Loading daily challenges...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {challenges.map((dc) => {
            const pct = Math.min(
              100,
              Math.round((dc.progress / Math.max(1, dc.targetScore)) * 100),
            );
            return (
              <div
                key={dc.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-secondary/30 p-4 space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#E91E63] tabular-nums">
                      +{dc.rewardXp} XP · +{dc.rewardPoints} pts
                    </span>
                    {dc.rewardClaimed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Claimed
                      </span>
                    ) : dc.completed ? (
                      <span className="text-emerald-400 font-semibold">Ready to Claim</span>
                    ) : null}
                  </div>

                  <h4 className="font-display text-sm font-bold text-foreground">{dc.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{dc.description}</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>Progress</span>
                      <span>
                        {dc.progress} / {dc.targetScore}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-[#E91E63] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {dc.completed && !dc.rewardClaimed ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={claimingId === dc.id}
                      onClick={() => void handleClaim(dc.id)}
                      className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      <Gift className="h-3.5 w-3.5 mr-1.5" />
                      {claimingId === dc.id ? "Claiming..." : "Claim Reward"}
                    </Button>
                  ) : !dc.completed ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onLaunchGame(dc.gameSlug)}
                      className="w-full h-8 text-xs"
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5 text-[#E91E63]" />
                      Play Mission
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
