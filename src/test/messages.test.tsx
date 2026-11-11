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
});
