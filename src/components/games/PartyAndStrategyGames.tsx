import { useState, useEffect, useMemo } from "react";
import {
  Bot,
  Users,
  RotateCcw,
  Sparkles,
  Check,
  SkipForward,
  Plus,
  Swords,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gameAudio } from "@/lib/gameAudio";
import {
  evaluateTicTacToe,
  chooseTicTacToeAiMove,
  evaluateRpsRound,
  type TicTacToeCell,
  type RpsMove,
  type GameQuestion,
  type GameRoomPlayer,
  type GameSlug,
  type RoomEventPayload,
} from "@/services/games";
import { MatchSummaryCard } from "./GameArenaShell";

interface PartyStrategyProps {
  myUserId: string;
  myUsername: string;
  players: GameRoomPlayer[];
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
// 5. TIC-TAC-TOE (VS COMPUTER AI & MULTIPLAYER ROOM)
// ============================================================================

export function TicTacToeGame({
  myUserId,
  players,
  isMultiplayer,
  roomEvents,
  onBroadcast,
  onFinishMatch,
  onBackToLobby,
}: PartyStrategyProps) {
  const [difficulty, setDifficulty] = useState<"casual" | "smart">("smart");
  const [board, setBoard] = useState<TicTacToeCell[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [aiThinking, setAiThinking] = useState(false);
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });
  const [startedAt, setStartedAt] = useState(Date.now());
  const [matchReward, setMatchReward] = useState<{ xpEarned: number; pointsEarned: number } | null>(
    null,
  );
  const [recordedBoardKey, setRecordedBoardKey] = useState("");

  // In multiplayer, player[0] is X, player[1] is O
  const myMark: "X" | "O" =
    isMultiplayer && players.length >= 2 && players[1]?.userId === myUserId ? "O" : "X";

  const evaluation = useMemo(() => evaluateTicTacToe(board), [board]);

  // Listen for multiplayer moves & rematches
  useEffect(() => {
    if (!isMultiplayer || roomEvents.length === 0) return;
    const latest = roomEvents[roomEvents.length - 1];
    if (!latest) return;

    if (latest.type === "move" && Array.isArray(latest.data["board"])) {
      setBoard(latest.data["board"] as TicTacToeCell[]);
      if (latest.data["nextTurn"] === "X" || latest.data["nextTurn"] === "O") {
        setTurn(latest.data["nextTurn"]);
      }
    } else if (latest.type === "rematch") {
      setBoard(Array(9).fill(null));
      setTurn("X");
      setMatchReward(null);
      setRecordedBoardKey("");
      setStartedAt(Date.now());
    }
  }, [isMultiplayer, roomEvents]);

  // Record finished match outcome once per completed board
  useEffect(() => {
    if (!evaluation.winner) return;
    const key = board.map((c) => c ?? "_").join("");
    if (recordedBoardKey === key) return;
    setRecordedBoardKey(key);

    if (evaluation.winner === "X") {
      setScores((s) => ({ ...s, X: s.X + 1 }));
    } else if (evaluation.winner === "O") {
      setScores((s) => ({ ...s, O: s.O + 1 }));
    } else {
      setScores((s) => ({ ...s, draws: s.draws + 1 }));
    }

    const result: "win" | "loss" | "draw" =
      evaluation.winner === "draw" ? "draw" : evaluation.winner === myMark ? "win" : "loss";

    if (result === "win") gameAudio.win();
    else if (result === "loss") gameAudio.wrong();

    void onFinishMatch({
      gameSlug: "tic-tac-toe",
      mode: isMultiplayer ? "multiplayer" : "ai",
      result,
      score: result === "win" ? 200 : result === "draw" ? 90 : 40,
      durationSeconds: Math.max(4, Math.round((Date.now() - startedAt) / 1000)),
    }).then(setMatchReward);
  }, [evaluation.winner, board, recordedBoardKey, myMark, isMultiplayer, onFinishMatch, startedAt]);

  // Computer AI turn (550ms realistic delay)
  useEffect(() => {
    if (isMultiplayer || evaluation.winner || turn !== "O") return;
    setAiThinking(true);
    const id = setTimeout(() => {
      const moveIdx = chooseTicTacToeAiMove(board, "O", difficulty);
      if (moveIdx >= 0 && board[moveIdx] === null) {
        const next = [...board];
        next[moveIdx] = "O";
        setBoard(next);
        setTurn("X");
        gameAudio.move();
      }
      setAiThinking(false);
    }, 550);
    return () => clearTimeout(id);
  }, [isMultiplayer, evaluation.winner, turn, board, difficulty]);

  async function handleCellClick(idx: number) {
    if (evaluation.winner || board[idx] !== null || aiThinking) return;
    if (isMultiplayer && turn !== myMark) return;
    if (!isMultiplayer && turn !== "X") return;

    const nextBoard = [...board];
    nextBoard[idx] = isMultiplayer ? myMark : "X";
    const nextTurn: "X" | "O" = (isMultiplayer ? myMark : "X") === "X" ? "O" : "X";

    setBoard(nextBoard);
    setTurn(nextTurn);
    gameAudio.move();

    if (isMultiplayer && onBroadcast) {
      await onBroadcast("move", { board: nextBoard, nextTurn });
    }
  }

  async function resetBoard() {
    setBoard(Array(9).fill(null));
    setTurn("X");
    setMatchReward(null);
    setRecordedBoardKey("");
    setStartedAt(Date.now());
    if (isMultiplayer && onBroadcast) {
      await onBroadcast("rematch", {});
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      {/* Mode & Difficulty Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-xs">
        <div className="flex items-center gap-2 font-semibold">
          {isMultiplayer ? (
            <>
              <Users className="h-4 w-4 text-[#E91E63]" />
              <span>PvP Duel · You are {myMark}</span>
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 text-[#E91E63]" />
              <span>Solo vs Computer (You: X)</span>
            </>
          )}
        </div>

        {!isMultiplayer && (
          <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
            {(["casual", "smart"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  setDifficulty(lvl);
                  void resetBoard();
                }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize ${
                  difficulty === lvl
                    ? "bg-card text-[#E91E63] font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {lvl} AI
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-2 text-center rounded-xl border border-border bg-secondary/40 p-3 tabular-nums">
        <div>
          <p className="text-[11px] text-muted-foreground">Player X</p>
          <p className="font-display text-lg font-bold text-[#E91E63]">{scores.X}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Draws</p>
          <p className="font-display text-lg font-bold text-foreground">{scores.draws}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">
            {isMultiplayer ? "Player O" : "CPU (O)"}
          </p>
          <p className="font-display text-lg font-bold text-sky-400">{scores.O}</p>
        </div>
      </div>

      {/* Turn / Outcome Banner */}
      <div className="text-center text-xs font-semibold">
        {evaluation.winner ? (
          <span className="text-[#E91E63]">
            {evaluation.winner === "draw"
              ? "Match Draw — evenly balanced!"
              : evaluation.winner === myMark
                ? "Victory! You claimed the grid."
                : `${isMultiplayer ? `Player ${evaluation.winner}` : "Computer AI"} wins this round.`}
          </span>
        ) : aiThinking ? (
          <span className="text-muted-foreground">Computer is thinking...</span>
        ) : (
          <span className="text-foreground">
            Current Turn: <strong className="text-[#E91E63]">{turn}</strong>
            {isMultiplayer && turn === myMark ? " (Your move)" : ""}
          </span>
        )}
      </div>

      {/* 3x3 Board */}
      <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-2.5">
        {board.map((cell, idx) => {
          const isWinningCell = evaluation.line?.includes(idx) ?? false;
          return (
            <button
              key={idx}
              type="button"
              aria-label={`Square ${idx + 1}${cell ? `: ${cell}` : ""}`}
              disabled={Boolean(cell || evaluation.winner || aiThinking)}
              onClick={() => void handleCellClick(idx)}
              className={`flex h-20 w-full items-center justify-center rounded-xl border font-display text-3xl font-extrabold transition-all ${
                isWinningCell
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-400 scale-[1.02]"
                  : "border-border bg-secondary/50 hover:border-[#E91E63]/50"
              } ${cell === "X" ? "text-[#E91E63]" : cell === "O" ? "text-sky-400" : ""}`}
            >
              {cell}
            </button>
          );
        })}
      </div>

      {/* Rematch Controls */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <Button
          type="button"
          onClick={() => void resetBoard()}
          className="bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs h-9 px-4 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          {evaluation.winner ? "Rematch" : "Reset Board"}
        </Button>
        {matchReward && (
          <span className="text-xs font-semibold text-emerald-500 tabular-nums">
            +{matchReward.xpEarned} XP · +{matchReward.pointsEarned} pts
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onBackToLobby}
          className="text-xs h-9 px-3 whitespace-nowrap shrink-0"
        >
          Lobby
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 6. ROCK PAPER SCISSORS (BEST OF 5 VS CPU OR LIVE PVP)
// ============================================================================

const RPS_OPTIONS: Array<{ id: RpsMove; label: string; emoji: string }> = [
  { id: "rock", label: "Rock", emoji: "🪨" },
  { id: "paper", label: "Paper", emoji: "📄" },
  { id: "scissors", label: "Scissors", emoji: "✂️" },
];

export function RockPaperScissorsGame({
  myUserId,
  isMultiplayer,
  roomEvents,
  onBroadcast,
  onFinishMatch,
  onBackToLobby,
}: PartyStrategyProps) {
  const [round, setRound] = useState(1);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [myMove, setMyMove] = useState<RpsMove | null>(null);
  const [oppMove, setOppMove] = useState<RpsMove | null>(null);
  const [roundNote, setRoundNote] = useState("Choose Rock, Paper, or Scissors to begin!");
  const [finished, setFinished] = useState(false);
  const [reward, setReward] = useState<{ xpEarned: number; pointsEarned: number } | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [pendingPeerMove, setPendingPeerMove] = useState<RpsMove | null>(null);

  useEffect(() => {
    if (!isMultiplayer || roomEvents.length === 0) return;
    const latest = roomEvents[roomEvents.length - 1];
    if (!latest) return;

    if (latest.type === "move" && latest.senderId !== myUserId) {
      const m = latest.data["move"] as RpsMove | undefined;
      if (m) setPendingPeerMove(m);
    } else if (latest.type === "rematch") {
      resetLocal();
    }
  }, [isMultiplayer, roomEvents, myUserId]);

  useEffect(() => {
    if (!isMultiplayer || !myMove || !pendingPeerMove) return;
    resolveRound(myMove, pendingPeerMove);
    setPendingPeerMove(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, myMove, pendingPeerMove]);

  function resolveRound(mine: RpsMove, theirs: RpsMove) {
    setOppMove(theirs);
    const outcome = evaluateRpsRound(mine, theirs);
    let nextMy = myScore;
    let nextOpp = oppScore;

    if (outcome === "a") {
      nextMy += 1;
      setMyScore(nextMy);
      setRoundNote(`You win Round ${round}! ${mine.toUpperCase()} beats ${theirs.toUpperCase()}.`);
      gameAudio.correct();
    } else if (outcome === "b") {
      nextOpp += 1;
      setOppScore(nextOpp);
      setRoundNote(
        `Opponent wins Round ${round}. ${theirs.toUpperCase()} beats ${mine.toUpperCase()}.`,
      );
      gameAudio.wrong();
    } else {
      setRoundNote(`Round ${round} Draw — both chose ${mine.toUpperCase()}.`);
      gameAudio.move();
    }

    if (nextMy >= 3 || nextOpp >= 3 || round >= 5) {
      setFinished(true);
      const matchResult = nextMy > nextOpp ? "win" : nextMy < nextOpp ? "loss" : "draw";
      if (matchResult === "win") gameAudio.win();
      void onFinishMatch({
        gameSlug: "rock-paper-scissors",
        mode: isMultiplayer ? "multiplayer" : "ai",
        result: matchResult,
        score: nextMy * 80 + (matchResult === "win" ? 100 : 20),
        durationSeconds: Math.max(4, Math.round((Date.now() - startedAt) / 1000)),
      }).then(setReward);
    } else {
      setTimeout(() => {
        setRound((r) => r + 1);
        setMyMove(null);
        setOppMove(null);
      }, 1100);
    }
  }

  async function pickMove(move: RpsMove) {
    if (myMove !== null || finished) return;
    setMyMove(move);
    gameAudio.move();

    if (isMultiplayer && onBroadcast) {
      await onBroadcast("move", { move, round });
      if (!pendingPeerMove) {
        setRoundNote("Move locked in! Waiting for opponent...");
      }
      return;
    }

    // CPU pick with brief anticipation delay
    setTimeout(() => {
      const cpuPool: RpsMove[] = ["rock", "paper", "scissors"];
      const cpuMove = cpuPool[Math.floor(Math.random() * 3)]!;
      resolveRound(move, cpuMove);
    }, 350);
  }

  function resetLocal() {
    setRound(1);
    setMyScore(0);
    setOppScore(0);
    setMyMove(null);
    setOppMove(null);
    setPendingPeerMove(null);
    setRoundNote("Choose Rock, Paper, or Scissors to begin!");
    setFinished(false);
    setReward(null);
    setStartedAt(Date.now());
  }

  async function handlePlayAgain() {
    resetLocal();
    if (isMultiplayer && onBroadcast) {
      await onBroadcast("rematch", {});
    }
  }

  if (finished) {
    const won = myScore > oppScore;
    return (
      <MatchSummaryCard
        title={
          won ? "You Won the Duel!" : myScore === oppScore ? "Match Tied" : "CPU Took This Set"
        }
        subtitle={`Final Score: You ${myScore} — ${oppScore} ${isMultiplayer ? "Opponent" : "CPU"}`}
        score={myScore * 80 + (won ? 100 : 20)}
        xpEarned={reward?.xpEarned ?? null}
        pointsEarned={reward?.pointsEarned ?? null}
        onPlayAgain={() => void handlePlayAgain()}
        onBackToLobby={onBackToLobby}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      <div className="flex items-center justify-between border-b border-border pb-3 text-xs tabular-nums">
        <span className="font-semibold flex items-center gap-1.5">
          <Swords className="h-4 w-4 text-[#E91E63]" />
          Round {round} of 5
        </span>
        <span className="font-semibold">
          You <strong className="text-[#E91E63]">{myScore}</strong> : <strong>{oppScore}</strong>{" "}
          {isMultiplayer ? "Opponent" : "CPU"}
        </span>
      </div>

      {/* Arena Showdown Display */}
      <div className="grid grid-cols-3 items-center gap-3 rounded-xl border border-border bg-secondary/40 p-5">
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">You</p>
          <div className="text-4xl h-12 flex items-center justify-center">
            {myMove ? RPS_OPTIONS.find((o) => o.id === myMove)?.emoji : "❔"}
          </div>
        </div>
        <div className="font-display text-sm font-bold text-muted-foreground">VS</div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">
            {isMultiplayer ? "Opponent" : "CPU"}
          </p>
          <div className="text-4xl h-12 flex items-center justify-center">
            {oppMove ? RPS_OPTIONS.find((o) => o.id === oppMove)?.emoji : "❔"}
          </div>
        </div>
      </div>

      <p className="text-xs font-medium text-foreground">{roundNote}</p>

      <div className="grid grid-cols-3 gap-3">
        {RPS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={myMove !== null}
            onClick={() => void pickMove(opt.id)}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border py-4 transition-all ${
              myMove === opt.id
                ? "border-[#E91E63] bg-[#E91E63]/15"
                : "border-border bg-secondary/40 hover:border-[#E91E63]/50"
            }`}
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span className="text-xs font-semibold">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 7. TRUTH OR DARE
// ============================================================================

export function TruthOrDareGame({
  myUsername,
  players,
  questions,
  isMultiplayer,
  roomEvents,
  onBroadcast,
  onFinishMatch,
  onBackToLobby,
}: PartyStrategyProps) {
  const bank = useMemo(() => questions.filter((q) => q.gameSlug === "truth-or-dare"), [questions]);
  const [intensity, setIntensity] = useState<"all" | "chill" | "bold" | "creator">("all");
  const [turnIdx, setTurnIdx] = useState(0);
  const [card, setCard] = useState<GameQuestion | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [score, setScore] = useState(0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customType, setCustomType] = useState<"truth" | "dare">("truth");
  const [reward, setReward] = useState<{ xpEarned: number; pointsEarned: number } | null>(null);
  const [finished, setFinished] = useState(false);

  const roster = players.length > 0 ? players.map((p) => `@${p.username}`) : [`@${myUsername}`];
  const activePlayer = roster[turnIdx % roster.length] ?? `@${myUsername}`;

  useEffect(() => {
    if (!isMultiplayer || roomEvents.length === 0) return;
    const latest = roomEvents[roomEvents.length - 1];
    if (latest?.type === "state_sync" && latest.data["card"]) {
      setCard(latest.data["card"] as GameQuestion);
      if (typeof latest.data["turnIdx"] === "number") setTurnIdx(latest.data["turnIdx"]);
    }
  }, [isMultiplayer, roomEvents]);

  async function drawCard(choice: "truth" | "dare") {
    const pool = bank.filter((q) => {
      const typeMatch = q.category.toLowerCase() === choice || q.clueMeta?.type === choice;
      const tierMatch = intensity === "all" || q.clueMeta?.intensity === intensity;
      return typeMatch && tierMatch;
    });
    const fallback = bank.filter((q) => q.category.toLowerCase() === choice);
    const list = pool.length > 0 ? pool : fallback.length > 0 ? fallback : bank;
    const picked = list[Math.floor(Math.random() * list.length)] ?? null;
    setCard(picked);
    gameAudio.move();
    if (isMultiplayer && onBroadcast && picked) {
      await onBroadcast("state_sync", { card: picked, turnIdx });
    }
  }

  async function completeTurn(completed: boolean) {
    const nextScore = score + (completed ? 50 : 10);
    const nextCount = completedCount + 1;
    const nextTurn = turnIdx + 1;
    setScore(nextScore);
    setCompletedCount(nextCount);
    setTurnIdx(nextTurn);
    setCard(null);
    if (completed) gameAudio.correct();

    if (nextCount >= 5) {
      setFinished(true);
      gameAudio.win();
      const res = await onFinishMatch({
        gameSlug: "truth-or-dare",
        mode: isMultiplayer ? "multiplayer" : "solo",
        result: "win",
        score: nextScore,
        durationSeconds: 45,
      });
      setReward(res);
    } else if (isMultiplayer && onBroadcast) {
      await onBroadcast("state_sync", { card: null, turnIdx: nextTurn });
    }
  }

  async function submitCustomCard(e: React.FormEvent) {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    const custom: GameQuestion = {
      id: `tod-custom-${Date.now()}`,
      gameSlug: "truth-or-dare",
      category: customType === "truth" ? "Truth" : "Dare",
      difficulty: "medium",
      prompt: customPrompt.trim(),
      options: [],
      correctAnswer: "",
      clueMeta: { type: customType, intensity: "bold" },
      isActive: true,
    };
    setCard(custom);
    setCustomPrompt("");
    if (isMultiplayer && onBroadcast) {
      await onBroadcast("state_sync", { card: custom, turnIdx });
    }
  }

  if (finished) {
    return (
      <MatchSummaryCard
        title="Party Round Wrapped!"
        subtitle={`Completed ${completedCount} Truth or Dare prompts.`}
        score={score}
        xpEarned={reward?.xpEarned ?? null}
        pointsEarned={reward?.pointsEarned ?? null}
        onPlayAgain={() => {
          setFinished(false);
          setCompletedCount(0);
          setScore(0);
          setCard(null);
          setReward(null);
        }}
        onBackToLobby={onBackToLobby}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 text-center">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-xs">
        <span className="font-semibold">
          Turn: <strong className="text-[#E91E63]">{activePlayer}</strong> · Round{" "}
          {completedCount + 1}/5
        </span>
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          {(["all", "chill", "bold", "creator"] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setIntensity(tier)}
              className={`rounded-md px-2 py-1 text-[11px] capitalize ${
                intensity === tier
                  ? "bg-card text-[#E91E63] font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {!card ? (
        <div className="space-y-5 py-4">
          <p className="text-sm text-muted-foreground">
            {activePlayer}, choose your fate or drop a custom prompt for the room:
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <Button
              type="button"
              onClick={() => void drawCard("truth")}
              className="h-16 bg-sky-600 hover:bg-sky-700 text-white font-display text-base font-bold rounded-xl"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Truth
            </Button>
            <Button
              type="button"
              onClick={() => void drawCard("dare")}
              className="h-16 bg-[#E91E63] hover:bg-[#C2185B] text-white font-display text-base font-bold rounded-xl"
            >
              <Flame className="h-4 w-4 mr-2" />
              Dare
            </Button>
          </div>

          <form onSubmit={submitCustomCard} className="mx-auto flex max-w-md gap-2 pt-2">
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value as "truth" | "dare")}
              className="h-9 rounded-lg border border-border bg-secondary px-2 text-xs"
            >
              <option value="truth">Truth</option>
              <option value="dare">Dare</option>
            </select>
            <Input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Write custom Truth or Dare..."
              className="h-9 text-xs bg-secondary"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-9 text-xs whitespace-nowrap shrink-0"
            >
              Deal
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <div className="rounded-2xl border border-[#E91E63]/30 bg-secondary/40 p-6 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#E91E63]">
              {card.category}
            </p>
            <p className="font-display text-lg sm:text-xl font-bold text-foreground leading-snug">
              {card.prompt}
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <Button
              type="button"
              onClick={() => void completeTurn(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Completed (+50)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void completeTurn(false)}
              className="text-xs h-9 px-4"
            >
              <SkipForward className="h-3.5 w-3.5 mr-1.5" />
              Skip Turn
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 8. WOULD YOU RATHER
// ============================================================================

export function WouldYouRatherGame({
  questions,
  isMultiplayer,
  roomEvents,
  onBroadcast,
  onFinishMatch,
  onBackToLobby,
}: PartyStrategyProps) {
  const baseDeck = useMemo(
    () => questions.filter((q) => q.gameSlug === "would-you-rather" && q.options.length >= 2),
    [questions],
  );
  const [customDilemmas, setCustomDilemmas] = useState<GameQuestion[]>([]);
  const deck = useMemo(
    () => [...customDilemmas, ...baseDeck].slice(0, 5),
    [customDilemmas, baseDeck],
  );

  const [idx, setIdx] = useState(0);
  const [votedIdx, setVotedIdx] = useState<number | null>(null);
  const [roomVotes, setRoomVotes] = useState<Record<string, number>>({});
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [reward, setReward] = useState<{ xpEarned: number; pointsEarned: number } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");

  useEffect(() => {
    const votes: Record<string, number> = {};
    for (const ev of roomEvents) {
      if (ev.type === "vote" && ev.data["round"] === idx && typeof ev.data["choice"] === "number") {
        votes[ev.senderUsername] = ev.data["choice"];
      }
      if (ev.type === "state_sync" && ev.data["dilemma"]) {
        setCustomDilemmas((prev) => [ev.data["dilemma"] as GameQuestion, ...prev]);
      }
    }
    setRoomVotes(votes);
  }, [roomEvents, idx]);

  const current = deck[idx];

  async function castVote(choiceIdx: number) {
    if (votedIdx !== null || !current) return;
    setVotedIdx(choiceIdx);
    setScore((s) => s + 30);
    gameAudio.move();
    if (isMultiplayer && onBroadcast) {
      await onBroadcast("vote", { round: idx, choice: choiceIdx });
    }
  }

  async function nextQuestion() {
    if (idx + 1 >= deck.length) {
      setFinished(true);
      gameAudio.win();
      const res = await onFinishMatch({
        gameSlug: "would-you-rather",
        mode: isMultiplayer ? "multiplayer" : "solo",
        result: "win",
        score,
        durationSeconds: 30,
      });
      setReward(res);
    } else {
      setIdx((i) => i + 1);
      setVotedIdx(null);
      setRoomVotes({});
    }
  }

  async function addDilemma(e: React.FormEvent) {
    e.preventDefault();
    if (!optA.trim() || !optB.trim()) return;
    const item: GameQuestion = {
      id: `wyr-custom-${Date.now()}`,
      gameSlug: "would-you-rather",
      category: "Custom",
      difficulty: "easy",
      prompt: "Custom Room Dilemma:",
      options: [optA.trim(), optB.trim()],
      correctAnswer: "",
      isActive: true,
    };
    setCustomDilemmas((p) => [item, ...p]);
    if (isMultiplayer && onBroadcast) {
      await onBroadcast("state_sync", { dilemma: item });
    }
    setOptA("");
    setOptB("");
    setShowAdd(false);
    setIdx(0);
    setVotedIdx(null);
  }

  if (finished) {
    return (
      <MatchSummaryCard
        title="Dilemmas Complete"
        subtitle="Thanks for weighing in with the VIDALORE community."
        score={score}
        xpEarned={reward?.xpEarned ?? null}
        pointsEarned={reward?.pointsEarned ?? null}
        onPlayAgain={() => {
          setFinished(false);
          setIdx(0);
          setScore(0);
          setVotedIdx(null);
          setReward(null);
        }}
        onBackToLobby={onBackToLobby}
      />
    );
  }

  // Deterministic community split + live room votes
  const peerList = Object.values(roomVotes);
  const aVotes = 42 + peerList.filter((c) => c === 0).length * 15 + (votedIdx === 0 ? 15 : 0);
  const bVotes = 38 + peerList.filter((c) => c === 1).length * 15 + (votedIdx === 1 ? 15 : 0);
  const total = Math.max(1, aVotes + bVotes);
  const pctA = Math.round((aVotes / total) * 100);
  const pctB = 100 - pctA;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-3 text-xs">
        <span className="font-semibold text-muted-foreground tabular-nums">
          Dilemma {idx + 1} / {deck.length} · {current?.category}
        </span>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1 font-medium text-[#E91E63] hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Dilemma
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={addDilemma}
          className="rounded-xl border border-border bg-secondary/40 p-4 space-y-2.5"
        >
          <Input
            value={optA}
            onChange={(e) => setOptA(e.target.value)}
            placeholder="Option A..."
            className="h-9 text-xs bg-card"
          />
          <Input
            value={optB}
            onChange={(e) => setOptB(e.target.value)}
            placeholder="Option B..."
            className="h-9 text-xs bg-card"
          />
          <Button
            type="submit"
            size="sm"
            className="h-8 text-xs bg-[#E91E63] hover:bg-[#C2185B] text-white"
          >
            Add to Deck
          </Button>
        </form>
      )}

      <h3 className="font-display text-lg font-bold text-center">{current?.prompt}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {current?.options.slice(0, 2).map((opt, oIdx) => {
          const pct = oIdx === 0 ? pctA : pctB;
          const isChosen = votedIdx === oIdx;
          return (
            <button
              key={opt}
              type="button"
              disabled={votedIdx !== null}
              onClick={() => void castVote(oIdx)}
              className={`relative overflow-hidden rounded-xl border p-5 text-left transition-all ${
                isChosen
                  ? "border-[#E91E63] bg-[#E91E63]/15"
                  : "border-border bg-secondary/40 hover:border-[#E91E63]/50"
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#E91E63] mb-1.5">
                Option {oIdx === 0 ? "A" : "B"}
              </p>
              <p className="text-sm font-semibold text-foreground leading-snug">{opt}</p>
              {votedIdx !== null && (
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between text-xs font-bold tabular-nums">
                    <span>{isChosen ? "Your Pick" : "Vote Share"}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full ${oIdx === 0 ? "bg-[#E91E63]" : "bg-sky-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {votedIdx !== null && (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            onClick={() => void nextQuestion()}
            className="bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs h-9 px-5"
          >
            {idx + 1 >= deck.length ? "Finish Round" : "Next Dilemma"}
          </Button>
        </div>
      )}
    </div>
  );
}
