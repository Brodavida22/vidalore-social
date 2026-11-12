import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { COMMON_EMOJIS } from "@/components/messages/ReactionPicker";

vi.mock("@/integrations/supabase/client", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "user-123", email: "test@vidalore.com" } },
      error: null,
    }),
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: "user-123", email: "test@vidalore.com" },
          access_token: "mock-token",
        },
      },
      error: null,
    }),
  };

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
      auth: mockAuth,
    },
  };
});

describe("Advanced Messaging System", () => {
  it("matches the /messages route", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });

    const matches = router.matchRoutes("/messages");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    expect(matches.some((m) => m.pathname === "/messages")).toBe(true);
  });

  it("provides standard reaction emojis including signature rose 🌹", () => {
    expect(COMMON_EMOJIS).toContain("❤️");
    expect(COMMON_EMOJIS).toContain("👍");
    expect(COMMON_EMOJIS).toContain("🌹");
  });

  it("correctly identifies group administrators and member roles", () => {
    const members = [
      { user_id: "user-1", role: "admin" },
      { user_id: "user-2", role: "member" },
    ];

    const admin = members.find((m) => m.role === "admin");
    const regular = members.find((m) => m.role === "member");

    expect(admin?.user_id).toBe("user-1");
    expect(regular?.user_id).toBe("user-2");
  });

  it("properly formats reactions map and distinguishes self reactions", () => {
    const reactions = [
      { emoji: "❤️", user_id: "alice" },
      { emoji: "❤️", user_id: "bob" },
      { emoji: "🌹", user_id: "alice" },
    ];

    const currentUserId = "alice";
    const map = new Map<string, { count: number; reactedByMe: boolean }>();

    for (const rx of reactions) {
      const existing = map.get(rx.emoji) ?? { count: 0, reactedByMe: false };
      existing.count += 1;
      if (rx.user_id === currentUserId) {
        existing.reactedByMe = true;
      }
      map.set(rx.emoji, existing);
    }

    expect(map.get("❤️")?.count).toBe(2);
    expect(map.get("❤️")?.reactedByMe).toBe(true);
    expect(map.get("🌹")?.count).toBe(1);
    expect(map.get("🌹")?.reactedByMe).toBe(true);
  });

  it("handles per-user cleared chat timestamp in local storage", async () => {
    const { getPerUserClearedTimestamp, setPerUserClearedTimestamp } =
      await import("@/services/messages");

    const userId = "test-user-clear";
    const convId = "conv-123";

    expect(getPerUserClearedTimestamp(userId, convId)).toBe(0);

    const now = Date.now();
    setPerUserClearedTimestamp(userId, convId, now);

    expect(getPerUserClearedTimestamp(userId, convId)).toBe(now);
  });

  it("handles per-user deleted message IDs (Delete For Me)", async () => {
    const { getPerUserDeletedMessageIds, addPerUserDeletedMessageId } =
      await import("@/services/messages");

    const userId = "test-user-del-me";
    const msgId1 = "msg-111";
    const msgId2 = "msg-222";

    const initial = getPerUserDeletedMessageIds(userId);
    expect(initial.has(msgId1)).toBe(false);

    addPerUserDeletedMessageId(userId, msgId1);
    addPerUserDeletedMessageId(userId, msgId2);

    const updated = getPerUserDeletedMessageIds(userId);
    expect(updated.has(msgId1)).toBe(true);
    expect(updated.has(msgId2)).toBe(true);
    expect(updated.has("msg-333")).toBe(false);
  });

  it("handles per-user hidden conversations and auto-unhide", async () => {
    const {
      getPerUserHiddenConversations,
      setPerUserHiddenConversation,
      unhideConversationForUser,
    } = await import("@/services/messages");

    const userId = "test-user-hide";
    const convId = "conv-hidden-1";

    expect(getPerUserHiddenConversations(userId)[convId]).toBeUndefined();

    const hiddenAt = Date.now();
    setPerUserHiddenConversation(userId, convId, hiddenAt);

    expect(getPerUserHiddenConversations(userId)[convId]).toBe(hiddenAt);

    unhideConversationForUser(userId, convId);
    expect(getPerUserHiddenConversations(userId)[convId]).toBeUndefined();
  });

  it("correctly enforces group role hierarchy and moderation permissions", async () => {
    const { getEffectiveRole, canManageGroup, canPromoteDemote, canRemoveGroupMember } =
      await import("@/services/messages");

    const conversation = {
      id: "conv-group-1",
      created_by: "user-creator",
      kind: "group",
    } as unknown as Parameters<typeof getEffectiveRole>[1];

    const members = [
      { user_id: "user-creator", role: "admin" },
      { user_id: "user-admin", role: "admin" },
      { user_id: "user-mod", role: "moderator" },
      { user_id: "user-regular", role: "member" },
    ] as unknown as Parameters<typeof getEffectiveRole>[2];

    expect(getEffectiveRole("user-creator", conversation, members)).toBe("owner");
    expect(getEffectiveRole("user-admin", conversation, members)).toBe("admin");
    expect(getEffectiveRole("user-mod", conversation, members)).toBe("moderator");
    expect(getEffectiveRole("user-regular", conversation, members)).toBe("member");

    // Permissions:
    expect(canManageGroup("owner")).toBe(true);
    expect(canManageGroup("admin")).toBe(true);
    expect(canManageGroup("moderator")).toBe(false);
    expect(canManageGroup("member")).toBe(false);

    // Group Owner Controls:
    expect(canPromoteDemote("owner", "member", "admin")).toBe(true);
    expect(canPromoteDemote("owner", "admin", "member")).toBe(true);
    expect(canPromoteDemote("owner", "member", "moderator")).toBe(true);
    expect(canPromoteDemote("owner", "moderator", "member")).toBe(true);
    expect(canPromoteDemote("owner", "admin", "moderator")).toBe(true);
    expect(canPromoteDemote("owner", "moderator", "admin")).toBe(true);
    // Owner cannot be removed or demoted:
    expect(canPromoteDemote("owner", "owner", "admin")).toBe(false);
    expect(canPromoteDemote("owner", "owner", "member")).toBe(false);
    expect(canRemoveGroupMember("owner", "owner", false)).toBe(false);
    // Owner can remove admins, moderators, and ordinary members:
    expect(canRemoveGroupMember("owner", "admin", false)).toBe(true);
    expect(canRemoveGroupMember("owner", "moderator", false)).toBe(true);
    expect(canRemoveGroupMember("owner", "member", false)).toBe(true);

    // Group Admin Controls:
    // Admin can promote ordinary member to moderator:
    expect(canPromoteDemote("admin", "member", "moderator")).toBe(true);
    // Admin can demote moderator to member:
    expect(canPromoteDemote("admin", "moderator", "member")).toBe(true);
    // Admin CANNOT promote to admin:
    expect(canPromoteDemote("admin", "member", "admin")).toBe(false);
    expect(canPromoteDemote("admin", "moderator", "admin")).toBe(false);
    // Admin CANNOT promote or demote other admins:
    expect(canPromoteDemote("admin", "admin", "member")).toBe(false);
    expect(canPromoteDemote("admin", "admin", "moderator")).toBe(false);
    // Admin CANNOT promote or demote owner:
    expect(canPromoteDemote("admin", "owner", "member")).toBe(false);
    // Admin can remove moderator and ordinary member:
    expect(canRemoveGroupMember("admin", "moderator", false)).toBe(true);
    expect(canRemoveGroupMember("admin", "member", false)).toBe(true);
    // Admin CANNOT remove owner or another admin:
    expect(canRemoveGroupMember("admin", "owner", false)).toBe(false);
    expect(canRemoveGroupMember("admin", "admin", false)).toBe(false);

    // Moderator & Member Controls:
    // Moderator has NO role management privileges:
    expect(canPromoteDemote("moderator", "member", "moderator")).toBe(false);
    expect(canPromoteDemote("moderator", "member", "admin")).toBe(false);
    expect(canRemoveGroupMember("moderator", "member", false)).toBe(false);
    expect(canRemoveGroupMember("moderator", "admin", false)).toBe(false);
    // Member cannot promote or remove others:
    expect(canPromoteDemote("member", "member", "admin")).toBe(false);
    expect(canRemoveGroupMember("member", "admin", false)).toBe(false);
    expect(canRemoveGroupMember("member", "member", false)).toBe(false);
    // Any member can remove themselves (leave):
    expect(canRemoveGroupMember("member", "member", true)).toBe(true);
    expect(canRemoveGroupMember("moderator", "moderator", true)).toBe(true);
    expect(canRemoveGroupMember("admin", "admin", true)).toBe(true);
  });

  describe("Group Administration PostgreSQL RPC Functions", () => {
    it("calls group_add_member RPC with p_conversation_id and p_user_id", async () => {
      const { addGroupMembers } = await import("@/services/messages");
      const { supabase } = await import("@/integrations/supabase/client");

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      } as unknown as never);

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { created_by: "user-123" },
                  error: null,
                }),
              }),
            }),
          } as unknown as never;
        }
        if (table === "conversation_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ user_id: "user-123", role: "owner" }],
                error: null,
              }),
            }),
          } as unknown as never;
        }
        return {} as unknown as never;
      });

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123", email: "test@vidalore.com" } as unknown as never },
        error: null,
      });

      await addGroupMembers("conv-123", ["user-456"]);

      expect(supabase.rpc).toHaveBeenCalledWith("group_add_member", {
        p_conversation_id: "conv-123",
        p_user_id: "user-456",
      });
    });

    it("calls group_set_member_role RPC with p_conversation_id, p_user_id, and p_new_role", async () => {
      const { updateGroupMemberRole } = await import("@/services/messages");
      const { supabase } = await import("@/integrations/supabase/client");

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      } as unknown as never);

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { created_by: "user-123" },
                  error: null,
                }),
              }),
            }),
          } as unknown as never;
        }
        if (table === "conversation_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { user_id: "user-123", role: "owner" },
                  { user_id: "user-456", role: "member" },
                ],
                error: null,
              }),
            }),
          } as unknown as never;
        }
        return {} as unknown as never;
      });

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123", email: "test@vidalore.com" } as unknown as never },
        error: null,
      });

      await updateGroupMemberRole("conv-123", "user-456", "admin");

      expect(supabase.rpc).toHaveBeenCalledWith("group_set_member_role", {
        p_conversation_id: "conv-123",
        p_user_id: "user-456",
        p_new_role: "admin",
      });
    });

    it("calls group_remove_member RPC with p_conversation_id and p_user_id", async () => {
      const { removeGroupMember } = await import("@/services/messages");
      const { supabase } = await import("@/integrations/supabase/client");

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      } as unknown as never);

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { created_by: "user-123" },
                  error: null,
                }),
              }),
            }),
          } as unknown as never;
        }
        if (table === "conversation_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { user_id: "user-123", role: "owner" },
                  { user_id: "user-456", role: "member" },
                ],
                error: null,
              }),
            }),
          } as unknown as never;
        }
        return {} as unknown as never;
      });

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123", email: "test@vidalore.com" } as unknown as never },
        error: null,
      });

      await removeGroupMember("conv-123", "user-456");

      expect(supabase.rpc).toHaveBeenCalledWith("group_remove_member", {
        p_conversation_id: "conv-123",
        p_user_id: "user-456",
      });
    });

    it("throws clear error when PostgreSQL RPC returns authorization error", async () => {
      const { updateGroupMemberRole } = await import("@/services/messages");
      const { supabase } = await import("@/integrations/supabase/client");

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: "permission denied for function group_set_member_role", code: "42501" },
      } as unknown as never);

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { created_by: "user-123" },
                  error: null,
                }),
              }),
            }),
          } as unknown as never;
        }
        if (table === "conversation_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { user_id: "user-123", role: "owner" },
                  { user_id: "user-456", role: "member" },
                ],
                error: null,
              }),
            }),
          } as unknown as never;
        }
        return {} as unknown as never;
      });

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123", email: "test@vidalore.com" } as unknown as never },
        error: null,
      });

      await expect(updateGroupMemberRole("conv-123", "user-456", "admin")).rejects.toThrow(
        "permission denied for function group_set_member_role",
      );
    });
  });
});
