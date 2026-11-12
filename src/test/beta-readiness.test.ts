import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  const mockFrom = vi.fn();
  const mockStorage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: "test-path" }, error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.mock/signed-test-video.mp4" },
        error: null,
      }),
    }),
  };
  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: "user-beta-1", email: "tester1@vidalore.com" },
          access_token: "mock-token-1",
        },
      },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: { id: "user-beta-1", email: "tester1@vidalore.com" },
      },
      error: null,
    }),
  };

  return {
    supabase: {
      from: mockFrom,
      storage: mockStorage,
      auth: mockAuth,
      supabaseUrl: "https://mwfognruqmatlhrirxlb.supabase.co",
      supabaseKey: "sb_publishable_mock",
    },
  };
});

import { supabase } from "@/integrations/supabase/client";
import { submitBetaFeedback, getStoredFeedbackHistory } from "@/services/feedback";
import {
  deleteReel,
  deleteStory,
  sessionReelsCache,
  type ReelItem,
} from "@/services/reelsAndStories";

describe("Phase 8: Beta Launch Readiness Audits & Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionReelsCache.clear();
  });

  describe("1. Beta Feedback System", () => {
    it("submits a bug report with diagnostics and persists receipt locally", async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "content_reports") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "report-123" },
                  error: null,
                }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const result = await submitBetaFeedback({
        type: "bug",
        title: "Video buffering on mobile",
        description: "When opening reels, playback stalled on 3G network.",
        deviceInfo: "Android 14 Chrome 128",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe("report-123");

      const history = getStoredFeedbackHistory();
      expect(history.length).toBe(1);
      expect(history[0]?.title).toBe("Video buffering on mobile");
      expect(history[0]?.type).toBe("bug");
    });

    it("submits a feature suggestion cleanly", async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "content_reports") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "report-456" },
                  error: null,
                }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const result = await submitBetaFeedback({
        type: "feature",
        title: "Add volume slider for reels",
        description: "It would be great to control volume smoothly.",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe("report-456");
    });
  });

  describe("2. User Content Ownership & Data Isolation", () => {
    it("prevents user from deleting another creator's reel", async () => {
      const otherUserReel: ReelItem = {
        id: "reel-other-999",
        creatorId: "user-other-creator",
        creatorName: "Other Creator",
        creatorUsername: "other",
        videoUrl: "https://mock.storage/video.mp4",
        caption: "Not your reel",
        likesCount: 10,
        commentsCount: 2,
        sharesCount: 0,
        savesCount: 1,
        viewsCount: 50,
        createdAt: new Date().toISOString(),
      };

      sessionReelsCache.set(otherUserReel.id, otherUserReel);

      await expect(deleteReel("reel-other-999")).rejects.toThrow(
        "You can only delete your own reels.",
      );
    });

    it("allows a creator to delete their own reel and cleans up cache", async () => {
      const ownReel: ReelItem = {
        id: "reel-own-111",
        creatorId: "user-beta-1", // Matches authenticated mock user
        creatorName: "Beta Tester",
        creatorUsername: "tester1",
        videoUrl: "https://mock.storage/own-video.mp4",
        storagePath: "user-beta-1/reel.mp4",
        caption: "My test reel",
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        savesCount: 0,
        viewsCount: 1,
        createdAt: new Date().toISOString(),
      };

      sessionReelsCache.set(ownReel.id, ownReel);

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "reels") {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      await expect(deleteReel("reel-own-111")).resolves.not.toThrow();
      expect(sessionReelsCache.has("reel-own-111")).toBe(false);
    });

    it("prevents user from deleting another user's story", async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "stories") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "story-other-555",
                    user_id: "different-user-id",
                    media_url: "user-different/story.jpg",
                  },
                  error: null,
                }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      await expect(deleteStory("story-other-555")).rejects.toThrow(
        "You can only delete your own stories.",
      );
    });
  });

  describe("3. PWA Configuration Verification", () => {
    it("verifies manifest.json exists with required PWA standalone metadata", async () => {
      // In node environment, verify public/manifest.json contains valid JSON
      const fs = await import("fs");
      const path = await import("path");
      const manifestPath = path.resolve(process.cwd(), "public/manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      expect(content.id).toBe("/");
      expect(content.display).toBe("standalone");
      expect(content.name).toBe("VIDALORE SOCIAL");
      expect(content.short_name).toBe("VIDALORE");
      expect(content.icons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
