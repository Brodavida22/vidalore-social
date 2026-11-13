import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Gamepad2,
  Trophy,
  Flame,
  Users,
  Sparkles,
  Play,
  DoorOpen,
  History,
  Award,
  Search,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  myProfileQuery,
  communityProfilesQuery,
  achievementsForUserQuery,
} from "@/services/profiles";
import {
  gamesCatalogQuery,
  gameQuestionsQuery,
  userGameProfileQuery,
  gameHistoryQuery,
  gamesLeaderboardQuery,
  publicGameRoomsQuery,
  gamesKeys,
  createGameRoom,
  joinGameRoomByCode,
  submitGameResult,
  subscribeToGamesLobbyPresence,
  connectGameRoomChannel,
  type GameCategory,
  type GameDefinition,
  type GameRoom,
  type GameRoomPlayer,
  type GameSlug,
  type OnlinePlayer,
  type RoomEventPayload,
} from "@/services/games";
import { GameArenaShell } from "@/components/games/GameArenaShell";
import {
  QuizBattleGame,
  WordChallengeGame,
  EmojiChallengeGame,
  MusicGuessingGame,
} from "@/components/games/TriviaAndWordGames";
import {
  TicTacToeGame,
  RockPaperScissorsGame,
  TruthOrDareGame,
  WouldYouRatherGame,
} from "@/components/games/PartyAndStrategyGames";
import { MemeChallengeGame, DailyChallengesPanel } from "@/components/games/CreativeAndDailyGames";

export const Route = createFileRoute("/_authenticated/games")({
  head: () => ({
    meta: [
      { title: "Games Center — VIDALORE SOCIAL" },
      {
        name: "description",
        content:
          "Play multiplayer social games, daily challenges, and climb the VIDALORE leaderboard.",
      },
    ],
  }),
  component: GamesCenterPage,
});

const CATEGORIES: GameCategory[] = [
  "All",
  "Trivia",
  "Party",
  "Strategy",
  "Word & Puzzle",
  "Creative",
  "Daily",
];

function GamesCenterPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(myProfileQuery());
  const { data: friends = [] } = useQuery(communityProfilesQuery(20));
  const { data: catalogRes, isLoading: loadingCatalog } = useQuery(gamesCatalogQuery());
  const { data: allQuestions = [] } = useQuery(gameQuestionsQuery());
  const { data: gameProfile } = useQuery(userGameProfileQuery());
  const { data: history = [] } = useQuery(gameHistoryQuery());
  const { data: leaderboard = [] } = useQuery(gamesLeaderboardQuery());
  const { data: publicRooms = [], refetch: refetchRooms } = useQuery(publicGameRoomsQuery());
  const { data: earnedAchievements = [] } = useQuery({
    ...achievementsForUserQuery(me?.id ?? ""),
    enabled: Boolean(me?.id),
  });

  const [hubTab, setHubTab] = useState<"lobby" | "daily" | "leaderboard" | "history">("lobby");
  const [category, setCategory] = useState<GameCategory>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [joiningCode, setJoiningCode] = useState(false);

  // Active arena state
  const [activeSlug, setActiveSlug] = useState<GameSlug | null>(null);
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<GameRoomPlayer[]>([]);
  const [roomEvents, setRoomEvents] = useState<RoomEventPayload[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);

  const lobbyHandleRef = useRef<ReturnType<typeof subscribeToGamesLobbyPresence> | null>(null);
  const roomHandleRef = useRef<ReturnType<typeof connectGameRoomChannel> | null>(null);

  const games = catalogRes?.games ?? [];
  const activeGame = games.find((g) => g.slug === activeSlug) ?? null;

  // Handle URL deep-link (?room=XYZ&game=quiz-battle)
  useEffect(() => {
    if (typeof window === "undefined" || !me || games.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("room");
    const slug = params.get("game") as GameSlug | null;
    if (code && !activeRoom) {
      void handleJoinRoom(code, slug ?? "quiz-battle");
    } else if (slug && !activeSlug && games.some((g) => g.slug === slug && g.isEnabled)) {
      setActiveSlug(slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, games.length]);

  // Lobby Presence subscription
  useEffect(() => {
    if (!me) return;
    const handle = subscribeToGamesLobbyPresence(
      {
        id: me.id,
        username: me.username,
        display_name: me.display_name,
        avatar_url: me.avatar_url,
      },
      activeGame ? `Playing ${activeGame.title}` : "In Games Lobby",
      setOnlinePlayers,
    );
    lobbyHandleRef.current = handle;
    return () => {
      handle.cleanup();
      lobbyHandleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  // Update presence activity when switching active game
  useEffect(() => {
    lobbyHandleRef.current?.updateActivity(
      activeGame ? `Playing ${activeGame.title}` : "In Games Lobby",
      activeRoom?.roomCode,
    );
  }, [activeGame, activeRoom?.roomCode]);

  // Connect / disconnect room Realtime channel
  useEffect(() => {
    if (!activeRoom || !me) return;
    setRoomEvents([]);
    const handle = connectGameRoomChannel(
      activeRoom.roomCode,
      {
        id: me.id,
        username: me.username,
        display_name: me.display_name,
        avatar_url: me.avatar_url,
      },
      {
        onPlayersChange: setRoomPlayers,
        onEvent: (ev) => setRoomEvents((prev) => [...prev.slice(-40), ev]),
      },
    );
    roomHandleRef.current = handle;
    return () => {
      handle.disconnect();
      roomHandleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.roomCode, me?.id]);

  async function handleCreateRoom(visibility: "public" | "private", targetSlug?: GameSlug) {
    const slug = targetSlug ?? activeSlug ?? "quiz-battle";
    try {
      const room = await createGameRoom({ gameSlug: slug, visibility });
      setActiveSlug(room.gameSlug);
      setActiveRoom(room);
      setRoomPlayers(room.players);
      toast.success(
        `${visibility === "public" ? "Public" : "Private"} room ${room.roomCode} ready!`,
      );
      void refetchRooms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create game room.");
    }
  }

  async function handleJoinRoom(code: string, fallbackSlug: GameSlug = "quiz-battle") {
    setJoiningCode(true);
    try {
      const room = await joinGameRoomByCode(code, fallbackSlug);
      const targetDef = games.find((g) => g.slug === room.gameSlug);
      if (targetDef && !targetDef.isEnabled) {
        toast.error(`${targetDef.title} is currently disabled by administrators.`);
        return;
      }
      setActiveSlug(room.gameSlug);
      setActiveRoom(room);
      setRoomPlayers(room.players);
      setRoomCodeInput("");
      toast.success(`Joined room ${room.roomCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join room.");
    } finally {
      setJoiningCode(false);
    }
  }

  async function handleChallengeOnlinePlayer(player: OnlinePlayer) {
    try {
      const room = await createGameRoom({ gameSlug: "tic-tac-toe", visibility: "private" });
      setActiveSlug("tic-tac-toe");
      setActiveRoom(room);
      setRoomPlayers(room.players);
      const { inviteFriendToGameViaDM } = await import("@/services/games");
      await inviteFriendToGameViaDM({
        friendUserId: player.userId,
        gameTitle: "Tic-Tac-Toe",
        gameSlug: "tic-tac-toe",
        roomCode: room.roomCode,
      });
      toast.success(`Sent room ${room.roomCode} challenge to @${player.username}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send challenge.");
    }
  }

  async function handleFinishMatch(input: {
    gameSlug: GameSlug;
    mode: "solo" | "ai" | "multiplayer";
    result: "win" | "loss" | "draw" | "completed";
    score: number;
    durationSeconds: number;
  }) {
    try {
      const res = await submitGameResult({
        gameSlug: input.gameSlug,
        mode: input.mode,
        result: input.result,
        rawScore: input.score,
        durationSeconds: input.durationSeconds,
        roomId: activeRoom?.id && !activeRoom.id.startsWith("rt-") ? activeRoom.id : null,
      });
      await queryClient.invalidateQueries({ queryKey: gamesKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
      return { xpEarned: res.xpEarned, pointsEarned: res.pointsEarned };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save match result.");
      return { xpEarned: 0, pointsEarned: 0 };
    }
  }

  function exitArena() {
    setActiveSlug(null);
    setActiveRoom(null);
    setRoomPlayers([]);
    setRoomEvents([]);
  }

  function launchGame(game: GameDefinition) {
    if (!game.isEnabled) {
      toast.error(`${game.title} is temporarily disabled by platform admins.`);
      return;
    }
    setActiveRoom(null);
    setRoomPlayers([]);
    setRoomEvents([]);
    setActiveSlug(game.slug);
  }

  const filteredGames = games.filter((g) => {
    const matchesCat = category === "All" || g.category === category;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q || g.title.toLowerCase().includes(q) || g.description.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const featuredGames = games.filter((g) => g.isFeatured && g.isEnabled);
  const recentGames = (gameProfile?.recentlyPlayedSlugs ?? [])
    .map((slug) => games.find((g) => g.slug === slug))
    .filter((g): g is GameDefinition => Boolean(g));

  // ============================================================================
  // ACTIVE GAME ARENA VIEW
  // ============================================================================
  if (activeGame && me) {
    const isMultiplayer = Boolean(activeRoom);
    const broadcastFn = roomHandleRef.current?.broadcast;

    return (
      <div className="mx-auto max-w-5xl px-3 sm:px-6 py-5 pb-24">
        <GameArenaShell
          game={activeGame}
          room={activeRoom}
          players={roomPlayers}
          onlinePlayers={onlinePlayers}
          friends={friends}
          myUserId={me.id}
          onExit={exitArena}
          onCreateRoom={(vis) => handleCreateRoom(vis, activeGame.slug)}
        >
          {activeGame.slug === "quiz-battle" && (
            <QuizBattleGame
              questions={allQuestions}
              isMultiplayer={isMultiplayer}
              roomEvents={roomEvents}
              onBroadcast={broadcastFn}
              onFinishMatch={handleFinishMatch}
              onBackToLobby={exitArena}
            />
          )}

          {activeGame.slug === "word-challenge" && (
            <WordChallengeGame
              questions={allQuestions}
              isMultiplayer={isMultiplayer}
              roomEvents={roomEvents}
              onBroadcast={broadcastFn}
              onFinishMatch={handleFinishMatch}
              onBackToLobby={exitArena}
            />
          )}

          {activeGame.slug === "emoji-challenge" && (
            <EmojiChallengeGame
              questions={allQuestions}
              isMultiplayer={isMultiplayer}
              roomEvents={roomEvents}
              onBroadcast={broadcastFn}
              onFinishMatch={handleFinishMatch}
              onBackToLobby={exitArena}
            />
          )}

          {activeGame.slug === "music-guessing" && (
            <MusicGuessingGame
              questions={allQuestions}
              isMultiplayer={isMultiplayer}
              roomEvents={roomEvents}
              onBroadcast={broadcastFn}
              onFinishMatch={handleFinishMatch}
              onBackToLobby={exitArena}
            />
          )}

          {activeGame.slug === "tic-tac-toe" && (
            <TicTacToeGame
              myUserId={me.id}
              myUsername={me.username}
              players={roomPlayers}
              questions={allQuestions}
              isMultiplayer={isMultiplayer}
              roomEvents={roomEvents}
              onBroadcast={broadcastFn}
              onFinishMatch={handleFinishMatch}
              onBackToLobby={exitArena}
            />
          )}

          {activeGame.slug === "rock-paper-scissors" && (
            <RockPaperScissorsGame
              myUserId={me.id}
              myUsername={me.username}
              players={roomPlayers}
              questions={allQuestions}
              isMultiplayer={isMultiplayer}
              roomEvents={roomEvents}
              onBroadcast={broadcastFn}
              onFinishMatch={handleFinishMatch}
              onBackToLobby={exitArena}
            />
          )}

          {activeGame.slug === "truth-or-dare" && (
            <TruthOrDareGame
              myUserId={me.id}
              myUsername={me.username}
              players={roomPlayers}
              questions={allQuestions}
              isMultiplayer={isMultiplayer}
              roomEvents={roomEvents}
              onBroadcast={broadcastFn}
              onFinishMatch={handleFinishMatch}
              onBackToLobby={exitArena}
            />
          )}

          {activeGame.slug === "would-you-rather" && (
            <WouldYouRatherGame
              myUserId={me.id}
              myUsername={me.username}
              players={roomPlayers}
              questions={allQuestions}
              isMultiplayer={isMultiplayer}
              roomEvents={roomEvents}
              onBroadcast={broadcastFn}
              onFinishMatch={handleFinishMatch}
              onBackToLobby={exitArena}
            />
          )}

          {activeGame.slug === "meme-challenge" && (
            <MemeChallengeGame
              myUserId={me.id}
              roomId={activeRoom?.id && !activeRoom.id.startsWith("rt-") ? activeRoom.id : null}
              onFinishMatch={handleFinishMatch}
            />
          )}

          {activeGame.slug === "daily-challenges" && (
            <DailyChallengesPanel
              onLaunchGame={(targetSlug) => {
                const target = games.find((g) => g.slug === targetSlug);
                if (target) launchGame(target);
              }}
            />
          )}
        </GameArenaShell>
      </div>
    );
  }

  // ============================================================================
  // GAMES CENTER LOBBY VIEW
  // ============================================================================
  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-6 py-5 pb-24 space-y-6">
      {/* Header + Room Join Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E91E63]/10 text-[#E91E63] border border-[#E91E63]/20">
              <Gamepad2 className="h-5 w-5" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              VIDALORE Games Center
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            10 social, trivia, word, party, and strategy games · Earn XP, streaks, and VIDA Points.
          </p>
        </div>

        {/* Join Room by Code */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (roomCodeInput.trim()) void handleJoinRoom(roomCodeInput);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            placeholder="Enter Room Code..."
            maxLength={8}
            className="h-9 w-44 font-mono text-xs uppercase tracking-wider bg-secondary"
          />
          <Button
            type="submit"
            disabled={joiningCode || !roomCodeInput.trim()}
            className="h-9 bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs whitespace-nowrap shrink-0"
          >
            <DoorOpen className="h-3.5 w-3.5 mr-1.5" />
            {joiningCode ? "Joining..." : "Join Room"}
          </Button>
        </form>
      </div>

      {/* Player Profile & Stats Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl border border-border bg-card p-4 tabular-nums">
        <div className="col-span-2 sm:col-span-1 flex items-center gap-3">
          {me && <UserAvatar profile={me} className="h-10 w-10 ring-1 ring-border shrink-0" />}
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">
              {me?.display_name || `@${me?.username ?? "player"}`}
            </p>
            <p className="text-[11px] font-semibold text-[#E91E63]">
              Level {gameProfile?.level ?? 1} · {gameProfile?.xp ?? 0} XP
            </p>
          </div>
        </div>

        <div className="border-l border-border/60 pl-3">
          <p className="text-[11px] text-muted-foreground">Matches Played</p>
          <p className="mt-0.5 font-display text-lg font-bold">{gameProfile?.gamesPlayed ?? 0}</p>
        </div>

        <div className="border-l border-border/60 pl-3">
          <p className="text-[11px] text-muted-foreground">Win Rate</p>
          <p className="mt-0.5 font-display text-lg font-bold text-emerald-500">
            {gameProfile?.winRate ?? 0}%
          </p>
        </div>

        <div className="border-l border-border/60 pl-3">
          <p className="text-[11px] text-muted-foreground">Win Streak</p>
          <p className="mt-0.5 font-display text-lg font-bold flex items-center gap-1">
            <Flame className="h-4 w-4 text-amber-500" />
            {gameProfile?.currentStreak ?? 0}
          </p>
        </div>

        <div className="border-l border-border/60 pl-3">
          <p className="text-[11px] text-muted-foreground">VIDA Balance</p>
          <p className="mt-0.5 font-display text-lg font-bold text-[#E91E63]">
            {me?.points_balance ?? 0} pts
          </p>
        </div>
      </section>

      {/* Primary Section Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1 overflow-x-auto">
          {(
            [
              { id: "lobby", label: "Games & Rooms", icon: Gamepad2 },
              { id: "daily", label: "Daily Challenges", icon: Sparkles },
              { id: "leaderboard", label: "Leaderboard", icon: Trophy },
              { id: "history", label: "Match History", icon: History },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setHubTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  hubTab === t.id
                    ? "bg-card text-[#E91E63] font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {hubTab === "lobby" && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search games..."
              className="h-9 pl-8 text-xs bg-secondary"
            />
          </div>
        )}
      </div>

      {/* TAB 1: GAMES & MULTIPLAYER LOBBY */}
      {hubTab === "lobby" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 8 cols: Categories + Featured + Recent + All Games */}
          <div className="lg:col-span-8 space-y-6">
            {/* Category Filter Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    category === cat
                      ? "border-[#E91E63] bg-[#E91E63] text-white"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Featured Highlights */}
            {category === "All" && !searchTerm && featuredGames.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Featured Games
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {featuredGames.slice(0, 4).map((g) => (
                    <div
                      key={g.slug}
                      className="flex flex-col justify-between rounded-xl border border-[#E91E63]/25 bg-card p-4 hover:border-[#E91E63]/60 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="font-semibold text-[#E91E63]">{g.category}</span>
                          <span className="tabular-nums">
                            {g.minPlayers}-{g.maxPlayers} players · {g.estimatedMinutes}
                          </span>
                        </div>
                        <h3 className="font-display text-base font-bold text-foreground">
                          {g.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {g.description}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between pt-2 border-t border-border/60">
                        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                          +{g.xpReward} XP · +{g.pointsReward} pts
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => launchGame(g)}
                          className="h-8 bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs whitespace-nowrap shrink-0"
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Play Now
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recently Played */}
            {recentGames.length > 0 && category === "All" && !searchTerm && (
              <section className="space-y-2.5">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Recently Played
                </h2>
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {recentGames.map((g) => (
                    <button
                      key={g.slug}
                      type="button"
                      onClick={() => launchGame(g)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-left text-xs hover:border-[#E91E63]/50 shrink-0"
                    >
                      <Play className="h-3.5 w-3.5 text-[#E91E63]" />
                      <span className="font-semibold text-foreground">{g.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Full Games Directory */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {category === "All" ? "All Games (10)" : `${category} Games`}
                </h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {filteredGames.length} available
                </span>
              </div>

              {loadingCatalog ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Skeleton className="h-36 rounded-xl" />
                  <Skeleton className="h-36 rounded-xl" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredGames.map((g) => (
                    <div
                      key={g.slug}
                      className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                        g.isEnabled
                          ? "border-border bg-card hover:border-[#E91E63]/50"
                          : "border-border bg-secondary/20 opacity-60"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                          <span>
                            {g.category}
                            {g.isPopular ? " · Popular" : ""}
                          </span>
                          <span>{g.playCount} plays</span>
                        </div>
                        <h3 className="font-display text-base font-bold text-foreground flex items-center gap-1.5">
                          {g.title}
                          {!g.isEnabled && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {g.description}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          +{g.xpReward} XP · +{g.pointsReward} pts
                        </span>
                        <div className="flex items-center gap-1.5">
                          {g.supportsMultiplayer && g.isEnabled && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleCreateRoom("private", g.slug)}
                              className="h-7 text-[11px] px-2.5 whitespace-nowrap shrink-0"
                            >
                              Room
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            disabled={!g.isEnabled}
                            onClick={() => launchGame(g)}
                            className="h-7 bg-[#E91E63] hover:bg-[#C2185B] text-white text-[11px] px-3 whitespace-nowrap shrink-0"
                          >
                            {g.isEnabled ? "Play" : "Disabled"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right 4 cols: Online Players + Public Rooms */}
          <div className="lg:col-span-4 space-y-4">
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-emerald-500" />
                  Online Players ({onlinePlayers.length})
                </h2>
              </div>

              {onlinePlayers.filter((p) => p.userId !== me?.id).length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">
                  You&apos;re in the Games Lobby. Open a room and invite any VIDALORE friend via DM!
                </p>
              ) : (
                <div className="space-y-2">
                  {onlinePlayers
                    .filter((p) => p.userId !== me?.id)
                    .map((op) => (
                      <div
                        key={op.userId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar
                            profile={{
                              username: op.username,
                              display_name: op.displayName,
                              avatar_url: op.avatarUrl,
                            }}
                            className="h-7 w-7 text-[10px]"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">@{op.username}</p>
                            <p className="text-[11px] text-emerald-500 truncate">{op.activity}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleChallengeOnlinePlayer(op)}
                          className="h-7 text-[11px] bg-[#E91E63] hover:bg-[#C2185B] text-white whitespace-nowrap shrink-0"
                        >
                          Challenge
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Open Public Rooms
                </h2>
                <button
                  type="button"
                  onClick={() => void refetchRooms()}
                  className="text-[11px] text-[#E91E63] hover:underline"
                >
                  Refresh
                </button>
              </div>

              {publicRooms.length === 0 ? (
                <div className="space-y-2.5 py-2 text-center">
                  <p className="text-xs text-muted-foreground">No open public rooms right now.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCreateRoom("public", "quiz-battle")}
                    className="h-8 text-xs w-full"
                  >
                    Host a Public Quiz Room
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {publicRooms.map((rm) => (
                    <div
                      key={rm.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">
                          {games.find((g) => g.slug === rm.gameSlug)?.title ?? rm.gameSlug}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {rm.roomCode} · @{rm.hostUsername}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleJoinRoom(rm.roomCode, rm.gameSlug)}
                        className="h-7 text-[11px] bg-[#E91E63] hover:bg-[#C2185B] text-white whitespace-nowrap shrink-0"
                      >
                        Join
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY CHALLENGES */}
      {hubTab === "daily" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <DailyChallengesPanel
            onLaunchGame={(targetSlug) => {
              const target = games.find((g) => g.slug === targetSlug);
              if (target) launchGame(target);
            }}
          />
        </div>
      )}

      {/* TAB 3: GLOBAL LEADERBOARD */}
      {hubTab === "leaderboard" && (
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#E91E63]" />
              Global Games Leaderboard
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              Top {leaderboard.length} players
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Rank</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Player</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Level</th>
                  <th className="px-4 py-2.5 text-right font-semibold">XP</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Wins</th>
                  <th className="px-4 py-2.5 text-right font-semibold">VIDA Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {leaderboard.map((row) => (
                  <tr key={row.userId} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-mono font-bold text-[#E91E63]">#{row.rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          profile={{
                            username: row.username,
                            display_name: row.displayName,
                            avatar_url: row.avatarUrl,
                          }}
                          className="h-6 w-6 text-[9px]"
                        />
                        <span className="font-semibold text-foreground">
                          {row.displayName || `@${row.username}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">Lv.{row.level}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{row.xp}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.gamesWon}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-500">
                      {row.pointsBalance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: MATCH HISTORY & ACHIEVEMENTS */}
      {hubTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-display text-sm font-bold">Recent Match History</h2>
            </div>

            {history.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                No completed matches yet. Launch any game from the lobby to start building your
                record!
              </p>
            ) : (
              <div className="divide-y divide-border">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-4 py-3 text-xs tabular-nums"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{item.gameTitle}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">
                        {item.mode} · {item.result} ·{" "}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-bold text-foreground">{item.score} pts</p>
                      <p className="text-[11px] text-[#E91E63]">
                        +{item.xpEarned} XP · +{item.pointsEarned} VIDA
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="font-display text-sm font-bold flex items-center gap-2">
              <Award className="h-4 w-4 text-[#E91E63]" />
              Unlocked Achievements
            </h2>
            {earnedAchievements.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Win matches and complete challenges to unlock badges.
              </p>
            ) : (
              <div className="space-y-2">
                {earnedAchievements.map((row, idx) => {
                  const ach = row.achievements as unknown as {
                    name: string;
                    description: string | null;
                  } | null;
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-border bg-secondary/40 p-3 text-xs"
                    >
                      <p className="font-semibold text-foreground">{ach?.name ?? "Badge"}</p>
                      {ach?.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {ach.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
