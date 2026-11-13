import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gamepad2, Plus, Trash2, Save, Copy, Database, Sparkles, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminGamesQuery,
  adminRewardsQuery,
  adminSaveGameConfig,
  adminSaveGameQuestion,
  adminDeleteQuestion,
  adminSaveRewardSetting,
  adminKeys,
  type AdminPermissions,
} from "@/services/admin";
import { gamesKeys, type GameDefinition, type GameSlug } from "@/services/games";
import { GAMES_AND_ADMIN_MIGRATION_SQL } from "@/lib/sql/gamesAndAdminSchema";

export function AdminGamesSection({ permissions }: { permissions: AdminPermissions }) {
  const queryClient = useQueryClient();
  const { data: gamesData, isLoading } = useQuery(adminGamesQuery());
  const { data: rewards = [] } = useQuery(adminRewardsQuery());

  const [subTab, setSubTab] = useState<"catalog" | "questions" | "rewards" | "schema">("catalog");
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [questionFilter, setQuestionFilter] = useState<GameSlug | "all">("all");
  const [copiedSql, setCopiedSql] = useState(false);

  // New question state
  const [newSlug, setNewSlug] = useState<GameSlug>("quiz-battle");
  const [newCategory, setNewCategory] = useState("General");
  const [newDifficulty, setNewDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [newPrompt, setNewPrompt] = useState("");
  const [newOptionsRaw, setNewOptionsRaw] = useState("");
  const [newCorrect, setNewCorrect] = useState("");
  const [newHint, setNewHint] = useState("");
  const [addingQ, setAddingQ] = useState(false);

  const games = gamesData?.games ?? [];
  const questions = (gamesData?.questions ?? []).filter(
    (q) => questionFilter === "all" || q.gameSlug === questionFilter,
  );

  async function handleToggleGame(game: GameDefinition, patch: Partial<GameDefinition>) {
    setSavingSlug(game.slug);
    try {
      await adminSaveGameConfig({
        slug: game.slug,
        isEnabled: patch.isEnabled ?? game.isEnabled,
        isFeatured: patch.isFeatured ?? game.isFeatured,
        category: patch.category ?? game.category,
        xpReward: patch.xpReward ?? game.xpReward,
        pointsReward: patch.pointsReward ?? game.pointsReward,
      });
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      await queryClient.invalidateQueries({ queryKey: gamesKeys.all });
      toast.success(`Updated ${game.title}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update game settings.");
    } finally {
      setSavingSlug(null);
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!newPrompt.trim()) {
      toast.error("Prompt is required.");
      return;
    }
    setAddingQ(true);
    try {
      const options = newOptionsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await adminSaveGameQuestion({
        gameSlug: newSlug,
        category: newCategory.trim() || "General",
        difficulty: newDifficulty,
        prompt: newPrompt.trim(),
        options,
        correctAnswer: newCorrect.trim(),
        hint: newHint.trim(),
        isActive: true,
      });
      setNewPrompt("");
      setNewOptionsRaw("");
      setNewCorrect("");
      setNewHint("");
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      await queryClient.invalidateQueries({ queryKey: gamesKeys.all });
      toast.success("Question saved to database.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save question.");
    } finally {
      setAddingQ(false);
    }
  }

  async function handleDeleteQuestion(id: string) {
    try {
      await adminDeleteQuestion(id);
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      await queryClient.invalidateQueries({ queryKey: gamesKeys.all });
      toast.success("Question deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete question.");
    }
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(GAMES_AND_ADMIN_MIGRATION_SQL);
      setCopiedSql(true);
      toast.success("Migration SQL copied to clipboard");
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      toast.error("Could not copy SQL.");
    }
  }

  return (
    <div className="space-y-4">
      {!gamesData?.schemaReady && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs">
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-400">
              Extended Games & Governance SQL Migration Ready
            </p>
            <p className="text-muted-foreground">
              The live database does not yet have the new games & governance RPC tables. Run the SQL
              script in Lovable Cloud / Supabase SQL Editor to persist config edits.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setSubTab("schema")}
            className="h-8 text-xs whitespace-nowrap shrink-0"
          >
            <Database className="h-3.5 w-3.5 mr-1.5" />
            View SQL Blueprint
          </Button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-secondary p-1 overflow-x-auto w-fit">
        {(
          [
            { id: "catalog", label: "Games & XP" },
            { id: "questions", label: "Questions Bank" },
            { id: "rewards", label: "Reward Settings" },
            { id: "schema", label: "SQL Blueprint" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`rounded-md px-3 py-1.5 text-xs whitespace-nowrap shrink-0 ${
              subTab === tab.id
                ? "bg-card text-[#E91E63] font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: GAMES CATALOG */}
      {subTab === "catalog" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Game</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Category</th>
                  <th className="px-4 py-2.5 text-right font-semibold">XP</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Points</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Plays</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Loading games catalog...
                    </td>
                  </tr>
                ) : (
                  games.map((g) => (
                    <tr key={g.slug} className="hover:bg-secondary/20">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <span className="flex items-center gap-2">
                          <Gamepad2 className="h-3.5 w-3.5 text-[#E91E63]" />
                          {g.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{g.category}</td>
                      <td className="px-4 py-3 text-right font-mono">{g.xpReward}</td>
                      <td className="px-4 py-3 text-right font-mono">{g.pointsReward}</td>
                      <td className="px-4 py-3 text-right font-mono">{g.playCount}</td>
                      <td className="px-4 py-3 text-right">
                        {permissions.canManageGames ? (
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={savingSlug === g.slug}
                              onClick={() =>
                                void handleToggleGame(g, { isFeatured: !g.isFeatured })
                              }
                              className={`h-7 text-[11px] px-2 ${
                                g.isFeatured ? "border-[#E91E63]/50 text-[#E91E63]" : ""
                              }`}
                            >
                              {g.isFeatured ? "Featured" : "Standard"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={g.isEnabled ? "default" : "destructive"}
                              disabled={savingSlug === g.slug}
                              onClick={() => void handleToggleGame(g, { isEnabled: !g.isEnabled })}
                              className={`h-7 text-[11px] px-2.5 ${
                                g.isEnabled ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                              }`}
                            >
                              {g.isEnabled ? "Enabled" : "Disabled"}
                            </Button>
                          </div>
                        ) : (
                          <span>{g.isEnabled ? "Enabled" : "Disabled"}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: QUESTIONS & PROMPTS */}
      {subTab === "questions" && (
        <div className="space-y-4">
          {permissions.canManageGames && (
            <form
              onSubmit={handleAddQuestion}
              className="rounded-xl border border-border bg-card p-4 space-y-3"
            >
              <h3 className="font-display text-sm font-bold flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#E91E63]" />
                Add Question or Prompt
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <select
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value as GameSlug)}
                  className="h-9 rounded-lg border border-border bg-secondary px-2.5 text-xs"
                >
                  <option value="quiz-battle">Quiz Battle</option>
                  <option value="truth-or-dare">Truth or Dare</option>
                  <option value="would-you-rather">Would You Rather</option>
                  <option value="word-challenge">Word Challenge</option>
                  <option value="emoji-challenge">Emoji Challenge</option>
                  <option value="music-guessing">Music Guessing</option>
                </select>

                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Category (e.g. Science, Movies)"
                  className="h-9 text-xs bg-secondary"
                />

                <select
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(e.target.value as "easy" | "medium" | "hard")}
                  className="h-9 rounded-lg border border-border bg-secondary px-2.5 text-xs"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <Input
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Prompt / Question text / Emoji sequence..."
                className="h-9 text-xs bg-secondary"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Input
                  value={newOptionsRaw}
                  onChange={(e) => setNewOptionsRaw(e.target.value)}
                  placeholder="Options comma-separated (Opt1, Opt2...)"
                  className="h-9 text-xs bg-secondary sm:col-span-2"
                />
                <Input
                  value={newCorrect}
                  onChange={(e) => setNewCorrect(e.target.value)}
                  placeholder="Correct answer"
                  className="h-9 text-xs bg-secondary"
                />
              </div>

              <div className="flex gap-2">
                <Input
                  value={newHint}
                  onChange={(e) => setNewHint(e.target.value)}
                  placeholder="Optional hint or fact..."
                  className="h-9 text-xs bg-secondary"
                />
                <Button
                  type="submit"
                  disabled={addingQ}
                  className="h-9 bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs whitespace-nowrap shrink-0"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {addingQ ? "Saving..." : "Save Question"}
                </Button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              Showing {questions.length} active questions/prompts
            </span>
            <select
              value={questionFilter}
              onChange={(e) => setQuestionFilter(e.target.value as GameSlug | "all")}
              className="h-8 rounded-lg border border-border bg-secondary px-2.5 text-xs"
            >
              <option value="all">All Games</option>
              <option value="quiz-battle">Quiz Battle</option>
              <option value="truth-or-dare">Truth or Dare</option>
              <option value="would-you-rather">Would You Rather</option>
              <option value="word-challenge">Word Challenge</option>
              <option value="emoji-challenge">Emoji Challenge</option>
              <option value="music-guessing">Music Guessing</option>
            </select>
          </div>

          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {questions.map((q) => (
              <div key={q.id} className="flex items-start justify-between gap-4 p-4 text-xs">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-foreground">
                    [{q.gameSlug}] {q.category} ·{" "}
                    <span className="capitalize text-muted-foreground">{q.difficulty}</span>
                  </p>
                  <p className="text-foreground break-words">{q.prompt}</p>
                  {q.correctAnswer && (
                    <p className="text-[11px] text-emerald-500">Answer: {q.correctAnswer}</p>
                  )}
                </div>
                {permissions.canManageGames && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(q.id) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDeleteQuestion(q.id)}
                    className="h-7 text-destructive hover:bg-destructive/10 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: PLATFORM REWARD SETTINGS */}
      {subTab === "rewards" && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {rewards.map((r) => (
            <div
              key={r.reason}
              className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs"
            >
              <div>
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#E91E63]" />
                  {r.label}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">{r.reason}</p>
              </div>
              <div className="flex items-center gap-2 tabular-nums">
                <span className="font-mono font-bold text-[#E91E63]">+{r.amount} pts</span>
                {permissions.canManageRewards && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await adminSaveRewardSetting({
                          reason: r.reason,
                          amount: r.amount,
                          label: r.label,
                          isActive: !r.isActive,
                        });
                        await queryClient.invalidateQueries({ queryKey: adminKeys.rewards() });
                        toast.success(`Reward ${r.reason} updated`);
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Could not update reward.",
                        );
                      }
                    }}
                    className="h-7 text-[11px]"
                  >
                    {r.isActive ? "Active" : "Paused"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUBTAB 4: SQL BLUEPRINT */}
      {subTab === "schema" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold">
                Games & Role-Based Admin SQL Migration
              </h3>
              <p className="text-xs text-muted-foreground">
                Idempotent PostgreSQL schema, RLS policies, and SECURITY DEFINER RPCs.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={copySql}
              className="h-8 bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs whitespace-nowrap shrink-0"
            >
              {copiedSql ? (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1.5" />
              )}
              {copiedSql ? "Copied" : "Copy SQL"}
            </Button>
          </div>
          <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-secondary/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {GAMES_AND_ADMIN_MIGRATION_SQL}
          </pre>
        </div>
      )}
    </div>
  );
}
