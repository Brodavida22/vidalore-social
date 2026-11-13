import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockAuth = {
    getSession: vi.fn(),
    getUser: vi.fn(),
  };
  const mockChannel = vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    track: vi.fn().mockResolvedValue("ok"),
    send: vi.fn().mockResolvedValue("ok"),
  });

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
      auth: mockAuth,
      channel: mockChannel,
      removeChannel: vi.fn(),
    },
  };
});

import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_GAMES_CATALOG,
  DEFAULT_QUESTIONS,
  generateRoomCode,
  evaluateTicTacToe,
  chooseTicTacToeAiMove,
  evaluateRpsRound,
  evaluateWordGuess,
  scrambleWord,
  isFuzzyAnswerMatch,
  sanitizeGameScore,
  calculatePlayerLevel,
  submitGameResult,
} from "@/services/games";
import { getMyAdminRole, isCurrentUserAdmin } from "@/services/moderation";
import {
  getPermissionsForRole,
  adminSetUserRole,
  adminSetUserGovernance,
  adminDeleteContentItem,
  adminSaveGameConfig,
} from "@/services/admin";

describe("VIDALORE Games Center & Admin Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("1. Games Catalog & Deterministic Engines", () => {
    it("includes all 10 required games in DEFAULT_GAMES_CATALOG", () => {
      expect(DEFAULT_GAMES_CATALOG).toHaveLength(10);
      const slugs = DEFAULT_GAMES_CATALOG.map((g) => g.slug);
      expect(slugs).toEqual(
        expect.arrayContaining([
          "quiz-battle",
          "truth-or-dare",
          "would-you-rather",
          "word-challenge",
          "emoji-challenge",
          "tic-tac-toe",
          "rock-paper-scissors",
          "meme-challenge",
          "music-guessing",
          "daily-challenges",
        ]),
      );
      expect(DEFAULT_QUESTIONS.length).toBeGreaterThanOrEqual(25);
    });

    it("generates 6-character alphanumeric room codes without ambiguous chars", () => {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    });

    it("evaluates Tic-Tac-Toe wins, draws, and smart AI blocks", () => {
      expect(evaluateTicTacToe(["X", "X", "X", null, "O", null, "O", null, null])).toEqual({
        winner: "X",
        line: [0, 1, 2],
      });
      expect(evaluateTicTacToe(["X", "O", "X", "X", "O", "O", "O", "X", "X"])).toEqual({
        winner: "draw",
        line: null,
      });

      // Smart AI blocks imminent human win at index 2
      const move = chooseTicTacToeAiMove(
        ["X", "X", null, null, "O", null, null, null, null],
        "O",
        "smart",
      );
      expect(move).toBe(2);
    });

    it("evaluates Rock Paper Scissors rounds accurately", () => {
      expect(evaluateRpsRound("rock", "scissors")).toBe("a");
      expect(evaluateRpsRound("rock", "paper")).toBe("b");
      expect(evaluateRpsRound("paper", "paper")).toBe("draw");
    });

    it("evaluates 5-letter Word Challenge guesses with duplicate letter handling", () => {
      // Target: FLAME, Guess: ALLOY -> A present, first L present, second L absent, O absent, Y absent
      expect(evaluateWordGuess("ALLOY", "FLAME")).toEqual([
        "present",
        "correct",
        "absent",
        "absent",
        "absent",
      ]);
      expect(evaluateWordGuess("FLAME", "FLAME")).toEqual([
        "correct",
        "correct",
        "correct",
        "correct",
        "correct",
      ]);
    });

    it("scrambles words without returning the original unscrambled string", () => {
      const scrambled = scrambleWord("VIDALORE");
      expect(scrambled).not.toBe("VIDALORE");
      expect(scrambled.split("").sort().join("")).toBe("VIDALORE".split("").sort().join(""));
    });

    it("matches song and emoji answers fuzzily", () => {
      expect(isFuzzyAnswerMatch("Blinding Lights!", "Blinding Lights")).toBe(true);
      expect(isFuzzyAnswerMatch("lion king", "The Lion King")).toBe(true);
      expect(isFuzzyAnswerMatch("ab", "Blinding Lights")).toBe(false);
    });

    it("clamps forged or invalid game scores and computes player levels", () => {
      expect(sanitizeGameScore(-100)).toBe(0);
      expect(sanitizeGameScore(999999)).toBe(5000);
      expect(sanitizeGameScore(Number.NaN)).toBe(0);

      expect(calculatePlayerLevel(0).level).toBe(1);
      expect(calculatePlayerLevel(400).level).toBe(3);
    });

    it("calls authoritative submit_game_session RPC and clamps score", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "player-1" } },
        error: null,
      } as never);

      const rpcMock = vi.mocked((supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc);
      rpcMock.mockResolvedValue({
        data: { xp_earned: 80, points_earned: 20, total_xp: 180, level: 2 },
        error: null,
      });

      const res = await submitGameResult({
        gameSlug: "quiz-battle",
        mode: "solo",
        result: "win",
        rawScore: 99999,
        durationSeconds: 45,
      });

      expect(rpcMock).toHaveBeenCalledWith(
        "submit_game_session",
        expect.objectContaining({
          p_game_slug: "quiz-battle",
          p_raw_score: 5000,
        }),
      );
      expect(res.persistedViaRpc).toBe(true);
      expect(res.xpEarned).toBe(80);
      expect(res.pointsEarned).toBe(20);
    });
  });

  describe("2. Role-Based Admin Security & Permissions", () => {
    it("enforces distinct permissions for super_admin, admin, moderator, and null", () => {
      const superPerms = getPermissionsForRole("super_admin");
      expect(superPerms.canManageRoles).toBe(true);
      expect(superPerms.canManageUsers).toBe(true);
      expect(superPerms.canManageGames).toBe(true);
      expect(superPerms.canModerateContent).toBe(true);

      const adminPerms = getPermissionsForRole("admin");
      expect(adminPerms.canManageRoles).toBe(false);
      expect(adminPerms.canManageUsers).toBe(true);
      expect(adminPerms.canManageGames).toBe(true);

      const modPerms = getPermissionsForRole("moderator");
      expect(modPerms.canManageRoles).toBe(false);
      expect(modPerms.canManageUsers).toBe(false);
      expect(modPerms.canManageGames).toBe(false);
      expect(modPerms.canModerateContent).toBe(true);
      expect(modPerms.canResolveReports).toBe(true);

      const userPerms = getPermissionsForRole(null);
      expect(userPerms.canViewOverview).toBe(false);
      expect(userPerms.canModerateContent).toBe(false);
    });

    it("resolves highest role from user_roles and rejects standard users", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: "user-1" } } },
        error: null,
      } as never);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ role: "moderator" }, { role: "super_admin" }],
            error: null,
          }),
        }),
      } as never);

      expect(await getMyAdminRole()).toBe("super_admin");
      expect(await isCurrentUserAdmin()).toBe(true);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ role: "user" }],
            error: null,
          }),
        }),
      } as never);

      expect(await getMyAdminRole()).toBeNull();
      expect(await isCurrentUserAdmin()).toBe(false);
    });

    it("blocks standard admins and moderators from calling adminSetUserRole", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: "admin-1" } } },
        error: null,
      } as never);
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [{ role: "admin" }], error: null }),
        }),
      } as never);

      await expect(adminSetUserRole({ targetUserId: "u-2", newRole: "admin" })).rejects.toThrow(
        "Super Admin",
      );
    });

    it("blocks moderators from banning users or editing game configs, while allowing content removal", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: "mod-1" } } },
        error: null,
      } as never);
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [{ role: "moderator" }], error: null }),
        }),
      } as never);

      await expect(
        adminSetUserGovernance({
          targetUserId: "u-2",
          accountStatus: "banned",
          isVerified: false,
        }),
      ).rejects.toThrow("Admin or Super Admin");

      await expect(
        adminSaveGameConfig({
          slug: "quiz-battle",
          isEnabled: false,
          isFeatured: false,
          category: "Trivia",
          xpReward: 60,
          pointsReward: 20,
        }),
      ).rejects.toThrow("Admin privileges required");

      const rpcMock = vi.mocked((supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc);
      rpcMock.mockResolvedValue({ data: null, error: null });

      await expect(
        adminDeleteContentItem({ targetType: "post", targetId: "post-1", reason: "Spam" }),
      ).resolves.not.toThrow();
      expect(rpcMock).toHaveBeenCalledWith("admin_delete_content", {
        p_target_type: "post",
        p_target_id: "post-1",
        p_reason: "Spam",
      });
    });
  });
});
