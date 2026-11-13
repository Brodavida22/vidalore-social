import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  Lightbulb,
  Music,
  Play,
  Sparkles,
  CheckCircle2,
  XCircle,
  Send,
  Volume2,
  Plus,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gameAudio } from "@/lib/gameAudio";
import {
  evaluateWordGuess,
  scrambleWord,
  isFuzzyAnswerMatch,
  type GameQuestion,
  type GameSlug,
  type RoomEventPayload,
} from "@/services/games";
import { MatchSummaryCard } from "./GameArenaShell";

interface CommonGameProps {
  questions: GameQuestion[];
  isMultiplayer: boolean;
  roomEvents: RoomEventPayload[];
  onBroadcast?:
    ((type: RoomEventPayload["type"], data: Record<string, unknown>) => Promise<void>) | undefined;
  onFinishMatch: (result: {
    gameSlug: GameSlug;
    mode: "solo" | "ai" | "multiplayer";
    result: "win" | "loss" | "draw" | "completed";
    score: number;
    durationSeconds: number;
  }) => Promise<{ xpEarned: number; pointsEarned: number }>;
  onBackToLobby: () => void;
}

// ============================================================================
// 1. QUIZ BATTLE
// ============================================================================

export function QuizBattleGame({
  questions,
  isMultiplayer,
  roomEvents,
  onBroadcast,
  onFinishMatch,
  onBackToLobby,
}: CommonGameProps) {
  const deck = useMemo(() => {
    const filtered = questions.filter((q) => q.gameSlug === "quiz-battle" && q.options.length >= 2);
    return filtered.slice(0, 6);
  }, [questions]);

  const [phase, setPhase] = useState<"menu" | "playing" | "finished">("menu");
  const [roundIdx, setRoundIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [reward, setReward] = useState<{ xpEarned: number; pointsEarned: number } | null>(null);
  const [peerScores, setPeerScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const latestScores: Record<string, number> = {};
    for (const ev of roomEvents) {
      if (ev.type === "score" && typeof ev.data["score"] === "number") {
        latestScores[ev.senderUsername] = ev.data["score"];
      }
      if (ev.type === "start" && phase === "menu") {
        startMatch();
      }
    }
    setPeerScores(latestScores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomEvents]);

  const currentQ = deck[roundIdx];

  const finishGame = useCallback(
    async (finalScore: number, hits: number) => {
      setPhase("finished");
      const durationSeconds = Math.max(5, Math.round((Date.now() - startedAt) / 1000));
      const didWin = hits >= Math.ceil(deck.length / 2);
      if (didWin) gameAudio.win();
      const res = await onFinishMatch({
        gameSlug: "quiz-battle",
        mode: isMultiplayer ? "multiplayer" : "solo",
        result: didWin ? "win" : "completed",
        score: finalScore,
        durationSeconds,
      });
      setReward(res);
    },
    [deck.length, isMultiplayer, onFinishMatch, startedAt],
  );

  const advanceRound = useCallback(
    (nextScore: number, nextHits: number) => {
      if (roundIdx + 1 >= deck.length) {
        void finishGame(nextScore, nextHits);
      } else {
        setRoundIdx((i) => i + 1);
        setSelectedOption(null);
        setTimeLeft(15);
      }
    },
    [deck.length, finishGame, roundIdx],
  );

  useEffect(() => {
    if (phase !== "playing" || selectedOption !== null) return;
    if (timeLeft <= 0) {
      gameAudio.wrong();
      setSelectedOption("__TIMEOUT__");
      const timer = setTimeout(() => advanceRound(score, correctCount), 1100);
      return () => clearTimeout(timer);
    }
    const id = setTimeout(() => {
      if (timeLeft <= 4) gameAudio.tick();
      setTimeLeft((t) => t - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [phase, selectedOption, timeLeft, advanceRound, score, correctCount]);

  function startMatch() {
    setRoundIdx(0);
    setScore(0);
    setCorrectCount(0);
    setSelectedOption(null);
    setTimeLeft(15);
    setReward(null);
    setStartedAt(Date.now());
    setPhase("playing");
    gameAudio.move();
  }

  async function handleSelectOption(option: string) {
    if (selectedOption !== null || !currentQ) return;
    setSelectedOption(option);
    const isCorrect = option === currentQ.correctAnswer;
    const speedBonus = isCorrect ? timeLeft * 5 : 0;
    const roundPoints = isCorrect ? 100 + speedBonus : 0;
    const nextScore = score + roundPoints;
    const nextHits = correctCount + (isCorrect ? 1 : 0);

    if (isCorrect) {
      gameAudio.correct();
    } else {
      gameAudio.wrong();
    }

    setScore(nextScore);
    setCorrectCount(nextHits);

    if (onBroadcast && isMultiplayer) {
      await onBroadcast("score", { score: nextScore, round: roundIdx + 1 });
    }

    setTimeout(() => advanceRound(nextScore, nextHits), 1100);
  }

  if (deck.length === 0) {
    return <p className="text-xs text-muted-foreground">No quiz questions active yet.</p>;
  }

  if (phase === "menu") {
    return (
      <div className="mx-auto max-w-lg py-6 text-center space-y-5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E91E63]/10 text-[#E91E63]">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-2xl font-bold">Quiz Battle</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Answer {deck.length} timed trivia questions across Science, Tech, Pop Culture, and
            Geography. Faster answers earn up to +75 speed bonus points per round.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            type="button"
            onClick={async () => {
              if (onBroadcast && isMultiplayer) {
                await onBroadcast("start", {});
              }
              startMatch();
            }}
            className="bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs h-10 px-6"
          >
            <Play className="h-4 w-4 mr-1.5" />
            {isMultiplayer ? "Start Room Match" : "Start Quiz"}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <MatchSummaryCard
        title="Quiz Complete"
        subtitle={`You answered ${correctCount} of ${deck.length} questions correctly.`}
        score={score}
        xpEarned={reward?.xpEarned ?? null}
        pointsEarned={reward?.pointsEarned ?? null}
        onPlayAgain={startMatch}
        onBackToLobby={onBackToLobby}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* HUD */}
      <div className="flex items-center justify-between border-b border-border pb-3 text-xs tabular-nums">
        <span className="font-semibold text-foreground">
          Question {roundIdx + 1} / {deck.length} ·{" "}
          <span className="text-muted-foreground">{currentQ?.category}</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-[#E91E63]">Score: {score}</span>
          <span
            className={`inline-flex items-center gap-1 font-mono font-bold ${
              timeLeft <= 5 ? "text-destructive" : "text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Live Room Scoreboard */}
      {isMultiplayer && Object.keys(peerScores).length > 0 && (
        <div className="flex flex-wrap gap-2 text-[11px] tabular-nums">
          {Object.entries(peerScores).map(([name, pts]) => (
            <span
              key={name}
              className="rounded-md border border-border bg-secondary px-2 py-1 font-medium"
            >
              @{name}: <strong className="text-[#E91E63]">{pts}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Question */}
      <div className="space-y-4">
        <h3 className="font-display text-lg sm:text-xl font-bold text-foreground leading-snug">
          {currentQ?.prompt}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {currentQ?.options.map((opt) => {
            const isChosen = selectedOption === opt;
            const isRight = opt === currentQ.correctAnswer;
            let cls =
              "border-border bg-secondary/40 text-foreground hover:border-[#E91E63]/60 hover:bg-secondary";

            if (selectedOption !== null) {
              if (isRight) {
                cls = "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-semibold";
              } else if (isChosen) {
                cls = "border-destructive bg-destructive/15 text-destructive";
              } else {
                cls = "border-border bg-secondary/20 text-muted-foreground opacity-60";
              }
            }

            return (
              <button
                key={opt}
                type="button"
                disabled={selectedOption !== null}
                onClick={() => handleSelectOption(opt)}
                className={`min-h-[48px] flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-xs sm:text-sm transition-colors ${cls}`}
              >
                <span>{opt}</span>
                {selectedOption !== null && isRight && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
                {selectedOption !== null && isChosen && !isRight && (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {selectedOption !== null && currentQ?.hint && (
          <p className="text-xs text-muted-foreground pt-1">Fact: {currentQ.hint}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 2. WORD CHALLENGE (SCRAMBLE + SPELLING + 5-LETTER GUESS)
// ============================================================================

export function WordChallengeGame({
  questions,
  isMultiplayer,
  onFinishMatch,
  onBackToLobby,
}: CommonGameProps) {
  const [subMode, setSubMode] = useState<"scramble" | "wordle" | "spelling">("wordle");
  const [phase, setPhase] = useState<"playing" | "finished">("playing");
  const [score, setScore] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [reward, setReward] = useState<{ xpEarned: number; pointsEarned: number } | null>(null);

  // Scramble / Spelling state
  const wordBank = useMemo(
    () => questions.filter((q) => q.gameSlug === "word-challenge"),
    [questions],
  );
  const scrambleTargets = useMemo(() => {
    const list = wordBank.filter((q) => q.clueMeta?.type !== "wordle");
    return list.length > 0 ? list : wordBank;
  }, [wordBank]);
  const fiveLetterWords = useMemo(() => {
    const list = wordBank
      .map((q) => q.correctAnswer.trim().toUpperCase())
      .filter((w) => w.length === 5);
    return list.length > 0 ? list : ["FLAME", "SPARK", "CROWN", "VIBES", "PRISM"];
  }, [wordBank]);

  const [targetIdx, setTargetIdx] = useState(0);
  const [scrambledText, setScrambledText] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  // 5-Letter Wordle state
  const [wordleTarget, setWordleTarget] = useState(() => fiveLetterWords[0] ?? "FLAME");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");

  useEffect(() => {
    const item = scrambleTargets[targetIdx % Math.max(1, scrambleTargets.length)];
    if (item) {
      setScrambledText(scrambleWord(item.correctAnswer));
    }
  }, [targetIdx, scrambleTargets]);

  async function completeWithScore(finalScore: number, won: boolean) {
    setPhase("finished");
    if (won) gameAudio.win();
    const res = await onFinishMatch({
      gameSlug: "word-challenge",
      mode: isMultiplayer ? "multiplayer" : "solo",
      result: won ? "win" : "completed",
      score: finalScore,
      durationSeconds: Math.max(8, Math.round((Date.now() - startedAt) / 1000)),
    });
    setReward(res);
  }

  function resetWordChallenge(nextMode = subMode) {
    setSubMode(nextMode);
    setPhase("playing");
    setScore(0);
    setReward(null);
    setStartedAt(Date.now());
    setTypedAnswer("");
    setFeedback(null);
    setTargetIdx((i) => (i + 1) % Math.max(1, scrambleTargets.length));
    const nextWord = fiveLetterWords[Math.floor(Math.random() * fiveLetterWords.length)] ?? "FLAME";
    setWordleTarget(nextWord);
    setGuesses([]);
    setCurrentGuess("");
  }

  function submitScrambleOrSpelling(e: React.FormEvent) {
    e.preventDefault();
    const current = scrambleTargets[targetIdx % scrambleTargets.length];
    if (!current) return;
    if (typedAnswer.trim().toUpperCase() === current.correctAnswer.trim().toUpperCase()) {
      gameAudio.correct();
      const nextScore = score + 120;
      setScore(nextScore);
      setFeedback("Correct! +120 pts");
      setTypedAnswer("");
      if (targetIdx + 1 >= Math.min(3, scrambleTargets.length)) {
        void completeWithScore(nextScore, true);
      } else {
        setTimeout(() => {
          setFeedback(null);
          setTargetIdx((i) => i + 1);
        }, 700);
      }
    } else {
      gameAudio.wrong();
      setFeedback("Not quite — check the hint or letter count.");
    }
  }

  function submitWordleGuess(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const clean = currentGuess
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    if (clean.length !== 5) {
      toast.error("Enter a 5-letter word.");
      return;
    }
    const nextGuesses = [...guesses, clean];
    setGuesses(nextGuesses);
    setCurrentGuess("");

    if (clean === wordleTarget) {
      const earned = Math.max(120, (7 - nextGuesses.length) * 60);
      setScore(earned);
      gameAudio.correct();
      setTimeout(() => void completeWithScore(earned, true), 650);
    } else if (nextGuesses.length >= 6) {
      gameAudio.wrong();
      setTimeout(() => void completeWithScore(40, false), 900);
    } else {
      gameAudio.move();
    }
  }

  if (phase === "finished") {
    return (
      <MatchSummaryCard
        title="Word Challenge Complete"
        subtitle={
          subMode === "wordle"
            ? `Target word was ${wordleTarget}`
            : "Great vocabulary and spelling speed."
        }
        score={score}
        xpEarned={reward?.xpEarned ?? null}
        pointsEarned={reward?.pointsEarned ?? null}
        onPlayAgain={() => resetWordChallenge(subMode)}
        onBackToLobby={onBackToLobby}
      />
    );
  }

  const activePrompt = scrambleTargets[targetIdx % Math.max(1, scrambleTargets.length)];

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Mode selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          {(
            [
              { id: "wordle", label: "5-Letter Guess" },
              { id: "scramble", label: "Word Scramble" },
              { id: "spelling", label: "Spelling Clue" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => resetWordChallenge(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                subMode === m.id
                  ? "bg-card text-[#E91E63] font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="text-xs font-semibold text-[#E91E63] tabular-nums">Score: {score}</span>
      </div>

      {subMode === "wordle" ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground text-center">
            Guess the 5-letter VIDALORE word in 6 tries. Green = exact spot, Amber = wrong spot.
          </p>

          {/* 6x5 Wordle Grid */}
          <div className="mx-auto grid max-w-[280px] gap-1.5">
            {Array.from({ length: 6 }).map((_, rowIdx) => {
              const guess = guesses[rowIdx];
              const states = guess ? evaluateWordGuess(guess, wordleTarget) : null;
              return (
                <div key={rowIdx} className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 5 }).map((__, colIdx) => {
                    const ch =
                      guess?.[colIdx] ??
                      (rowIdx === guesses.length ? (currentGuess[colIdx] ?? "") : "");
                    const st = states?.[colIdx];
                    const tileCls =
                      st === "correct"
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : st === "present"
                          ? "border-amber-500 bg-amber-500 text-zinc-950"
                          : st === "absent"
                            ? "border-zinc-700 bg-zinc-800 text-zinc-300"
                            : "border-border bg-secondary/40 text-foreground";
                    return (
                      <div
                        key={colIdx}
                        className={`flex h-12 w-full items-center justify-center rounded-lg border font-display text-lg font-bold uppercase ${tileCls}`}
                      >
                        {ch}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <form onSubmit={submitWordleGuess} className="mx-auto flex max-w-xs gap-2">
            <Input
              value={currentGuess}
              onChange={(e) => setCurrentGuess(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="Enter 5 letters..."
              maxLength={5}
              className="h-10 font-mono uppercase tracking-widest text-center text-sm bg-secondary"
            />
            <Button
              type="submit"
              className="h-10 bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs px-4 whitespace-nowrap shrink-0"
            >
              Guess
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-4 py-2 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {subMode === "scramble" ? "Unscramble the Word" : "Spell from Hint"}
          </p>

          {subMode === "scramble" ? (
            <div className="flex flex-wrap justify-center gap-2 py-2">
              {scrambledText.split("").map((ch, i) => (
                <span
                  key={`${ch}-${i}`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E91E63]/30 bg-[#E91E63]/10 font-display text-lg font-bold text-foreground"
                >
                  {ch}
                </span>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <p className="text-sm font-medium text-foreground">
                {activePrompt?.hint || "Type the matching word."}
              </p>
              <p className="mt-1 text-xs font-mono text-muted-foreground">
                Length: {activePrompt?.correctAnswer.length ?? 0} letters · Starts with{" "}
                <strong>{activePrompt?.correctAnswer[0]}</strong>
              </p>
            </div>
          )}

          {subMode === "scramble" && activePrompt?.hint && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
              Hint: {activePrompt.hint}
            </p>
          )}

          <form onSubmit={submitScrambleOrSpelling} className="mx-auto flex max-w-sm gap-2">
            <Input
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="h-10 text-sm uppercase tracking-wider bg-secondary"
            />
            <Button
              type="submit"
              className="h-10 bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs px-4 whitespace-nowrap shrink-0"
            >
              Submit
            </Button>
          </form>

          {feedback && <p className="text-xs font-medium text-[#E91E63]">{feedback}</p>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. EMOJI CHALLENGE
// ============================================================================

export function EmojiChallengeGame({
  questions,
  isMultiplayer,
  onFinishMatch,
  onBackToLobby,
}: CommonGameProps) {
  const deck = useMemo(
    () => questions.filter((q) => q.gameSlug === "emoji-challenge").slice(0, 6),
    [questions],
  );
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [phase, setPhase] = useState<"playing" | "finished">("playing");
  const [startedAt, setStartedAt] = useState(Date.now());
  const [reward, setReward] = useState<{ xpEarned: number; pointsEarned: number } | null>(null);

  const current = deck[idx];

  async function pickAnswer(option: string) {
    if (!current || selected !== null) return;
    setSelected(option);
    const correct = option === current.correctAnswer;
    const pts = correct ? (showHint ? 80 : 120) : 0;
    const nextScore = score + pts;
    const nextHits = hits + (correct ? 1 : 0);

    if (correct) gameAudio.correct();
    else gameAudio.wrong();

    setScore(nextScore);
    setHits(nextHits);

    setTimeout(async () => {
      if (idx + 1 >= deck.length) {
        setPhase("finished");
        if (nextHits >= 3) gameAudio.win();
        const res = await onFinishMatch({
          gameSlug: "emoji-challenge",
          mode: isMultiplayer ? "multiplayer" : "solo",
          result: nextHits >= 3 ? "win" : "completed",
          score: nextScore,
          durationSeconds: Math.max(5, Math.round((Date.now() - startedAt) / 1000)),
        });
        setReward(res);
      } else {
        setIdx((i) => i + 1);
        setSelected(null);
        setShowHint(false);
      }
    }, 900);
  }

  function restart() {
    setIdx(0);
    setScore(0);
    setHits(0);
    setSelected(null);
    setShowHint(false);
    setPhase("playing");
    setStartedAt(Date.now());
    setReward(null);
  }

  if (phase === "finished") {
    return (
      <MatchSummaryCard
        title="Emoji Challenge Complete"
        subtitle={`Decoded ${hits} of ${deck.length} emoji puzzles.`}
        score={score}
        xpEarned={reward?.xpEarned ?? null}
        pointsEarned={reward?.pointsEarned ?? null}
        onPlayAgain={restart}
        onBackToLobby={onBackToLobby}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 text-center">
      <div className="flex items-center justify-between border-b border-border pb-3 text-xs tabular-nums">
        <span className="font-semibold text-muted-foreground">
          Puzzle {idx + 1} / {deck.length} · {current?.category}
        </span>
        <span className="font-semibold text-[#E91E63]">Score: {score}</span>
      </div>

      <div className="rounded-2xl border border-border bg-secondary/40 py-8 px-4">
        <p className="text-4xl sm:text-5xl tracking-widest select-none">{current?.prompt}</p>
        {showHint && current?.hint && (
          <p className="mt-3 text-xs text-amber-400">Hint: {current.hint}</p>
        )}
      </div>

      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowHint(true)}
          disabled={showHint}
          className="text-xs text-muted-foreground"
        >
          <Lightbulb className="h-3.5 w-3.5 mr-1 text-amber-400" />
          {showHint ? "Hint Revealed" : "Reveal Hint (-40 bonus)"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
        {current?.options.map((opt) => {
          const isChosen = selected === opt;
          const isRight = opt === current.correctAnswer;
          let cls = "border-border bg-secondary/40 hover:border-[#E91E63]/50";
          if (selected !== null) {
            if (isRight)
              cls = "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-semibold";
            else if (isChosen) cls = "border-destructive bg-destructive/15 text-destructive";
            else cls = "border-border opacity-50";
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={selected !== null}
              onClick={() => void pickAnswer(opt)}
              className={`min-h-[46px] rounded-xl border px-4 py-3 text-xs sm:text-sm transition-colors ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 4. MUSIC GUESSING
// ============================================================================

export function MusicGuessingGame({
  questions,
  isMultiplayer,
  roomEvents,
  onBroadcast,
  onFinishMatch,
  onBackToLobby,
}: CommonGameProps) {
  const baseDeck = useMemo(
    () => questions.filter((q) => q.gameSlug === "music-guessing"),
    [questions],
  );
  const [customClues, setCustomClues] = useState<GameQuestion[]>([]);
  const deck = useMemo(() => [...customClues, ...baseDeck].slice(0, 6), [customClues, baseDeck]);

  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [typedGuess, setTypedGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState<"playing" | "finished">("playing");
  const [startedAt, setStartedAt] = useState(Date.now());
  const [reward, setReward] = useState<{ xpEarned: number; pointsEarned: number } | null>(null);

  // User-provided clue composer
  const [showClueComposer, setShowClueComposer] = useState(false);
  const [newClueText, setNewClueText] = useState("");
  const [newSongAnswer, setNewSongAnswer] = useState("");

  useEffect(() => {
    const incoming: GameQuestion[] = [];
    for (const ev of roomEvents) {
      if (ev.type === "state_sync" && ev.data["customSongClue"]) {
        incoming.push(ev.data["customSongClue"] as GameQuestion);
      }
    }
    if (incoming.length > 0) {
      setCustomClues(incoming);
    }
  }, [roomEvents]);

  const current = deck[idx];

  async function submitAnswer(answer: string) {
    if (!current || revealed) return;
    setRevealed(true);
    const correct =
      answer === current.correctAnswer || isFuzzyAnswerMatch(answer, current.correctAnswer);
    const pts = correct ? 120 : 0;
    const nextScore = score + pts;
    const nextHits = hits + (correct ? 1 : 0);

    if (correct) gameAudio.correct();
    else gameAudio.wrong();

    setScore(nextScore);
    setHits(nextHits);

    setTimeout(async () => {
      if (idx + 1 >= deck.length) {
        setPhase("finished");
        if (nextHits >= 3) gameAudio.win();
        const res = await onFinishMatch({
          gameSlug: "music-guessing",
          mode: isMultiplayer ? "multiplayer" : "solo",
          result: nextHits >= 3 ? "win" : "completed",
          score: nextScore,
          durationSeconds: Math.max(5, Math.round((Date.now() - startedAt) / 1000)),
        });
        setReward(res);
      } else {
        setIdx((i) => i + 1);
        setRevealed(false);
        setTypedGuess("");
      }
    }, 1000);
  }

  async function handlePublishClue(e: React.FormEvent) {
    e.preventDefault();
    if (!newClueText.trim() || !newSongAnswer.trim()) return;
    const clue: GameQuestion = {
      id: `custom-${Date.now()}`,
      gameSlug: "music-guessing",
      category: "Friend Clue",
      difficulty: "medium",
      prompt: newClueText.trim(),
      options: [],
      correctAnswer: newSongAnswer.trim(),
      hint: "Custom song clue shared by a player",
      isActive: true,
    };
    setCustomClues((prev) => [clue, ...prev]);
    if (onBroadcast && isMultiplayer) {
      await onBroadcast("state_sync", { customSongClue: clue });
    }
    setNewClueText("");
    setNewSongAnswer("");
    setShowClueComposer(false);
    setIdx(0);
    toast.success("Custom song clue added to the round!");
  }

  function restart() {
    setIdx(0);
    setScore(0);
    setHits(0);
    setRevealed(false);
    setTypedGuess("");
    setPhase("playing");
    setStartedAt(Date.now());
    setReward(null);
  }

  if (phase === "finished") {
    return (
      <MatchSummaryCard
        title="Music Session Complete"
        subtitle={`You named ${hits} of ${deck.length} tracks.`}
        score={score}
        xpEarned={reward?.xpEarned ?? null}
        pointsEarned={reward?.pointsEarned ?? null}
        onPlayAgain={restart}
        onBackToLobby={onBackToLobby}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-3 text-xs tabular-nums">
        <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
          <Music className="h-3.5 w-3.5 text-[#E91E63]" />
          Track {idx + 1} / {deck.length} · {current?.clueMeta?.genre || current?.category}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowClueComposer((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#E91E63] hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Song Clue
          </button>
          <span className="font-semibold text-foreground">Score: {score}</span>
        </div>
      </div>

      {showClueComposer && (
        <form
          onSubmit={handlePublishClue}
          className="rounded-xl border border-[#E91E63]/30 bg-secondary/40 p-4 space-y-2.5"
        >
          <p className="text-xs font-semibold text-foreground">Create a Song Clue for Players</p>
          <Input
            value={newClueText}
            onChange={(e) => setNewClueText(e.target.value)}
            placeholder="Lyric snippet, emoji clue, or hummed vibe..."
            className="h-9 text-xs bg-card"
          />
          <div className="flex gap-2">
            <Input
              value={newSongAnswer}
              onChange={(e) => setNewSongAnswer(e.target.value)}
              placeholder="Exact song title..."
              className="h-9 text-xs bg-card"
            />
            <Button
              type="submit"
              size="sm"
              className="h-9 bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs whitespace-nowrap shrink-0"
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Post Clue
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-border bg-secondary/40 p-5 space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Lyric / Clue
        </p>
        <p className="font-display text-base sm:text-lg font-semibold text-foreground leading-relaxed">
          {current?.prompt}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {current?.clueMeta?.melody && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => gameAudio.melodyPreview(current.clueMeta?.melody ?? [])}
              className="h-8 text-xs"
            >
              <Volume2 className="h-3.5 w-3.5 mr-1.5 text-[#E91E63]" />
              Play Synth Melody Preview
            </Button>
          )}
          {current?.hint && (
            <span className="text-xs text-muted-foreground">Hint: {current.hint}</span>
          )}
        </div>
      </div>

      {current?.options && current.options.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {current.options.map((opt) => {
            const isRight = opt === current.correctAnswer;
            let cls = "border-border bg-secondary/40 hover:border-[#E91E63]/50";
            if (revealed) {
              cls = isRight
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-semibold"
                : "border-border opacity-50";
            }
            return (
              <button
                key={opt}
                type="button"
                disabled={revealed}
                onClick={() => void submitAnswer(opt)}
                className={`min-h-[46px] rounded-xl border px-4 py-3 text-left text-xs sm:text-sm transition-colors ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitAnswer(typedGuess);
          }}
          className="flex gap-2"
        >
          <Input
            value={typedGuess}
            onChange={(e) => setTypedGuess(e.target.value)}
            placeholder="Type the song title..."
            className="h-10 text-sm bg-secondary"
          />
          <Button
            type="submit"
            disabled={revealed}
            className="h-10 bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs px-4 whitespace-nowrap shrink-0"
          >
            Check
          </Button>
        </form>
      )}
    </div>
  );
}
