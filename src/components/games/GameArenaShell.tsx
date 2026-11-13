import { useState } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Users,
  Send,
  Trophy,
  RotateCcw,
  Globe,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { isGameSoundMuted, setGameSoundMuted } from "@/lib/gameAudio";
import {
  inviteFriendToGameViaDM,
  type GameDefinition,
  type GameRoom,
  type GameRoomPlayer,
  type OnlinePlayer,
} from "@/services/games";
import type { Profile } from "@/services/profiles";

export interface FriendOption {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export function GameArenaShell({
  game,
  room,
  players,
  onlinePlayers,
  friends,
  myUserId,
  onExit,
  onCreateRoom,
  children,
}: {
  game: GameDefinition;
  room: GameRoom | null;
  players: GameRoomPlayer[];
  onlinePlayers: OnlinePlayer[];
  friends: FriendOption[];
  myUserId: string;
  onExit: () => void;
  onCreateRoom: (visibility: "public" | "private") => Promise<void>;
  children: React.ReactNode;
}) {
  const [muted, setMuted] = useState(() => isGameSoundMuted());
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setGameSoundMuted(next);
  }

  async function copyRoomCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      toast.success(`Room code ${room.roomCode} copied`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy room code.");
    }
  }

  async function handleStartRoom(visibility: "public" | "private") {
    setCreatingRoom(true);
    try {
      await onCreateRoom(visibility);
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleSendInvite(friend: FriendOption) {
    if (!room) return;
    setInvitingId(friend.id);
    try {
      await inviteFriendToGameViaDM({
        friendUserId: friend.id,
        gameTitle: game.title,
        gameSlug: game.slug,
        roomCode: room.roomCode,
      });
      toast.success(`Challenge sent to @${friend.username}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invite.");
    } finally {
      setInvitingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Arena Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="h-8 px-2.5 text-xs whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Lobby
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-foreground truncate">
              {game.title}
            </h2>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {game.category} · +{game.xpReward} XP · +{game.pointsReward} pts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {game.supportsMultiplayer && !room && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={creatingRoom}
                onClick={() => handleStartRoom("public")}
                className="h-8 text-xs whitespace-nowrap shrink-0"
              >
                <Globe className="h-3.5 w-3.5 mr-1.5 text-[#E91E63]" />
                Public Room
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={creatingRoom}
                onClick={() => handleStartRoom("private")}
                className="h-8 text-xs whitespace-nowrap shrink-0"
              >
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                Private Room
              </Button>
            </>
          )}

          {room && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={copyRoomCode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-mono font-semibold text-foreground hover:border-[#E91E63]/50"
                title="Copy room code"
              >
                <span>{room.roomCode}</span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <Button
                type="button"
                size="sm"
                onClick={() => setInviteOpen(true)}
                className="h-8 text-xs bg-[#E91E63] hover:bg-[#C2185B] text-white whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                Invite
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute game sounds" : "Mute game sounds"}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Live Room Roster */}
      {room && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-[#E91E63]" />
            <span className="font-semibold text-foreground">
              {room.visibility === "public" ? "Public Room" : "Private Room"}
            </span>
            <span>·</span>
            <span className="tabular-nums">{players.length} connected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {players.map((p) => (
              <div
                key={p.userId}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                  p.userId === myUserId
                    ? "border-[#E91E63]/40 bg-[#E91E63]/10 text-foreground"
                    : "border-border bg-card text-foreground"
                }`}
              >
                <UserAvatar
                  profile={{
                    username: p.username,
                    display_name: p.displayName,
                    avatar_url: p.avatarUrl,
                  }}
                  className="h-4 w-4 text-[8px]"
                />
                <span className="font-medium truncate max-w-[100px]">@{p.username}</span>
                {p.score > 0 && (
                  <span className="font-mono text-[11px] font-semibold text-[#E91E63] tabular-nums">
                    {p.score}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Game Viewport */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">{children}</div>

      {/* Friend Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Challenge a Friend</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Send your room code <span className="font-mono font-bold">{room?.roomCode}</span>{" "}
              directly to a VIDALORE member&apos;s inbox.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-80 overflow-y-auto pt-1">
            {onlinePlayers.filter((op) => op.userId !== myUserId).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Online in Games Center
                </p>
                {onlinePlayers
                  .filter((op) => op.userId !== myUserId)
                  .map((op) => (
                    <div
                      key={op.userId}
                      className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2"
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
                        disabled={invitingId === op.userId}
                        onClick={() =>
                          handleSendInvite({
                            id: op.userId,
                            username: op.username,
                            display_name: op.displayName,
                            avatar_url: op.avatarUrl,
                          })
                        }
                        className="h-7 text-xs bg-[#E91E63] hover:bg-[#C2185B] text-white whitespace-nowrap shrink-0"
                      >
                        {invitingId === op.userId ? "Sending..." : "Challenge"}
                      </Button>
                    </div>
                  ))}
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                VIDALORE Members
              </p>
              {friends.filter((f) => f.id !== myUserId).length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No other members available yet. Share code{" "}
                  <span className="font-mono font-bold">{room?.roomCode}</span>!
                </p>
              ) : (
                friends
                  .filter((f) => f.id !== myUserId)
                  .map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar profile={f} className="h-7 w-7 text-[10px]" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {f.display_name || `@${f.username}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            @{f.username}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={invitingId === f.id}
                        onClick={() => handleSendInvite(f)}
                        className="h-7 text-xs whitespace-nowrap shrink-0"
                      >
                        {invitingId === f.id ? "Sending..." : "Send Invite"}
                      </Button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MatchSummaryCard({
  title,
  subtitle,
  score,
  xpEarned,
  pointsEarned,
  onPlayAgain,
  onBackToLobby,
}: {
  title: string;
  subtitle: string;
  score: number;
  xpEarned: number | null;
  pointsEarned: number | null;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-6 text-center space-y-5">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E91E63]/10 text-[#E91E63] border border-[#E91E63]/20">
        <Trophy className="h-7 w-7" />
      </div>
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-secondary/40 p-4 tabular-nums">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Score</p>
          <p className="mt-1 font-display text-xl font-bold text-foreground">{score}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">XP</p>
          <p className="mt-1 font-display text-xl font-bold text-[#E91E63]">
            {xpEarned !== null ? `+${xpEarned}` : "..."}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Points</p>
          <p className="mt-1 font-display text-xl font-bold text-emerald-500">
            {pointsEarned !== null ? `+${pointsEarned}` : "..."}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          onClick={onPlayAgain}
          className="bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs h-9 px-4 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Play Again
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onBackToLobby}
          className="text-xs h-9 px-4 whitespace-nowrap shrink-0"
        >
          Back to Lobby
        </Button>
      </div>
    </div>
  );
}

export type ActiveProfile = Profile;
