import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockStorage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: "test-path" }, error: null }),
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
          user: { id: "user-123", email: "user@example.com" },
          access_token: "mock-token",
        },
      },
      error: null,
    }),
    refreshSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: "user-123", email: "user@example.com" },
          access_token: "refreshed-mock-token",
        },
      },
      error: null,
    }),
  };

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
      storage: mockStorage,
      auth: mockAuth,
      supabaseUrl: "https://mwfognruqmatlhrirxlb.supabase.co",
      supabaseKey: "sb_publishable_mock",
    },
  };
});

// Mock videoUpload to avoid WebCodecs requirement in Node/JSDOM environment
vi.mock("@/lib/videoUpload", () => ({
  compressVideoFile: vi.fn().mockImplementation(async (file: File) => ({
    file: new File(["mock-content"], file.name.replace(/\.[^.]+$/, ".mp4"), { type: "video/mp4" }),
    compressed: true,
    originalBytes: file.size,
    compressedBytes: file.size,
    convertedToH264: true,
  })),
  uploadVideoResumable: vi.fn().mockResolvedValue("user-123/mock-video.mp4"),
  formatBytes: vi.fn().mockReturnValue("1.0 MB"),
}));

import { supabase } from "@/integrations/supabase/client";
import {
  toggleReelLike,
  toggleReelSave,
  incrementReelShare,
  getSavedReels,
  removeSavedReel,
  getReelComments,
  addReelComment,
  toggleCommentReaction,
  addStory,
  type ReelItem,
} from "@/services/reelsAndStories";
import type { Profile } from "@/services/profiles";

describe("Reels & Stories Social Systems", () => {
  const mockMe: Profile = {
    id: "user-123",
    username: "vidalore_user",
    display_name: "Vidalore User",
    avatar_url: "https://example.com/avatar.jpg",
    bio: "Hello",
    created_at: new Date().toISOString(),
    points: 100,
    followers_count: 5,
    following_count: 10,
    friends_count: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Reel Likes", () => {
    it("likes a reel when not yet liked and returns hasLiked: true", async () => {
      // Mock: no existing like
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockCount = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
      });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          then: vi.fn(),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "reel_likes") {
          return {
            select: vi.fn().mockImplementation((_cols, opts) => {
              if (opts?.count === "exact") return mockCount();
              return mockSelect();
            }),
            insert: mockInsert,
            delete: vi.fn(),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === "reels") {
          return { update: mockUpdate } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const result = await toggleReelLike("reel-1");
      expect(result.hasLiked).toBe(true);
      expect(result.likesCount).toBe(1);
      expect(mockInsert).toHaveBeenCalledWith({ reel_id: "reel-1", user_id: "user-123" });
    });

    it("unlikes a reel when already liked and returns hasLiked: false", async () => {
      // Mock: existing like found
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { reel_id: "reel-1" }, error: null }),
          }),
        }),
      });
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      const mockCount = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          then: vi.fn(),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "reel_likes") {
          return {
            select: vi.fn().mockImplementation((_cols, opts) => {
              if (opts?.count === "exact") return mockCount();
              return mockSelect();
            }),
            insert: vi.fn(),
            delete: mockDelete,
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === "reels") {
          return { update: mockUpdate } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const result = await toggleReelLike("reel-1");
      expect(result.hasLiked).toBe(false);
      expect(result.likesCount).toBe(0);
    });
  });

  describe("2. Reel Comments", () => {
    it("adds a comment and returns author details", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          then: vi.fn(),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "reel_comments") {
          return { insert: mockInsert } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === "reels") {
          return { update: mockUpdate } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const comment = await addReelComment(mockMe, "reel-1", "Amazing reel! 🌹");
      expect(comment.content).toBe("Amazing reel! 🌹");
      expect(comment.authorId).toBe("user-123");
      expect(comment.authorUsername).toBe("vidalore_user");
      expect(mockInsert).toHaveBeenCalled();
    });

    it("toggles reaction on a reel comment", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "reel_comment_likes") {
          return {
            select: mockSelect,
            insert: mockInsert,
            delete: vi.fn(),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const reacted = await toggleCommentReaction("comment-1");
      expect(reacted).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith({ comment_id: "comment-1", user_id: "user-123" });
    });
  });

  describe("3. Reel Sharing", () => {
    it("increments share count via RPC", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });
      const count = await incrementReelShare("reel-1");
      expect(supabase.rpc).toHaveBeenCalledWith("increment_reel_shares", {
        target_reel_id: "reel-1",
      });
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("4. Saved Reels", () => {
    it("fetches saved reels for current user", async () => {
      const mockSaves = [{ reel_id: "reel-100", created_at: "2026-11-11T00:00:00Z" }];
      const mockReel = {
        id: "reel-100",
        creator_id: "creator-456",
        video_url: "user/video.mp4",
        caption: "Saved dance clip",
        audio_title: "Rose Beats",
        likes_count: 5,
        comments_count: 2,
        shares_count: 1,
        saves_count: 1,
        views_count: 50,
        created_at: "2026-11-10T00:00:00Z",
        tags: ["dance"],
      };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "reel_saves") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockSaves, error: null }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === "reels") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [mockReel], error: null }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "creator-456",
                    username: "creator_star",
                    display_name: "Creator Star",
                    avatar_url: null,
                  },
                ],
                error: null,
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === "reel_likes" || table === "reel_comments") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const savedList = await getSavedReels();
      expect(savedList).toHaveLength(1);
      expect(savedList[0]!.id).toBe("reel-100");
      expect(savedList[0]!.creatorUsername).toBe("creator_star");
      expect(savedList[0]!.hasSaved).toBe(true);
    });

    it("recovers gracefully when database returns 42501 is_blocked error on saved reel details", async () => {
      const mockSaves = [{ reel_id: "reel-blocked-100", created_at: "2026-11-11T00:00:00Z" }];
      const fallbackReel = {
        id: "reel-blocked-100",
        creator_id: "creator-999",
        video_url: "user/video-fallback.mp4",
        caption: "Fallback dance clip",
        audio_title: "Rose Beats",
        likes_count: 3,
        comments_count: 1,
        shares_count: 0,
        saves_count: 1,
        views_count: 20,
        created_at: "2026-11-10T00:00:00Z",
        tags: [],
      };

      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: RequestInfo | URL) => {
        const urlStr = String(url);
        if (urlStr.includes("/rest/v1/reels")) {
          return {
            ok: true,
            json: async () => [fallbackReel],
          } as unknown as Response;
        }
        return {
          ok: true,
          json: async () => ({}),
        } as unknown as Response;
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "reel_saves") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockSaves, error: null }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === "reels") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "42501", message: "permission denied for function is_blocked" },
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === "reel_likes" || table === "reel_comments") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      try {
        const savedList = await getSavedReels();
        expect(Array.isArray(savedList)).toBe(true);
        expect(savedList).toHaveLength(1);
        expect(savedList[0]!.id).toBe("reel-blocked-100");
        expect(savedList[0]!.hasSaved).toBe(true);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it("removes a reel from saved collection", async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "reel_saves") {
          return { delete: mockDelete } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      await removeSavedReel("reel-100");
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe("5. Story Upload & False Error Recovery", () => {
    it("handles idempotent story publishing without creating duplicates on retry", async () => {
      const storyId = "idempotent-story-id";
      // First attempt: already exists in DB
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "stories") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: storyId,
                    created_at: "2026-11-11T00:00:00Z",
                    expires_at: "2026-11-12T00:00:00Z",
                  },
                  error: null,
                }),
              }),
            }),
            insert: vi.fn(),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as unknown as ReturnType<typeof supabase.from>;
      });

      const result = await addStory(mockMe, {
        storyId,
        mediaUrl: "https://storage.mock/story.jpg",
        mediaPath: "user-123/story.jpg",
        mediaType: "image",
        caption: "Morning rose",
      });

      expect(result.id).toBe(storyId);
      expect(result.caption).toBe("Morning rose");
    });
  });
});
