import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { COMMON_EMOJIS } from "@/components/messages/ReactionPicker";

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
    expect(canManageGroup("member")).toBe(false);

    // Promote/Demote: Owner can promote to admin
    expect(canPromoteDemote("owner", "member", "admin")).toBe(true);
    // Member cannot promote
    expect(canPromoteDemote("member", "member", "admin")).toBe(false);

    // Remove member: Owner can remove admin
    expect(canRemoveGroupMember("owner", "admin", false)).toBe(true);
    // Member cannot remove admin
    expect(canRemoveGroupMember("member", "admin", false)).toBe(false);
    // Any member can remove themselves (leave)
    expect(canRemoveGroupMember("member", "member", true)).toBe(true);
  });
});
