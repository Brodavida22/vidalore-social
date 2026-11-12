import { describe, it, expect, vi } from "vitest";
import { formatBytes, compressVideoFile, isWebCodecsSupported } from "@/lib/videoUpload";

describe("Video Upload and Playback Utilities", () => {
  it("formats bytes into human readable MB strings correctly", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(-100)).toBe("0 MB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(15 * 1024 * 1024)).toBe("15.0 MB");
    expect(formatBytes(25.6 * 1024 * 1024, 2)).toBe("25.60 MB");
  });

  it("handles non-video files without throwing", async () => {
    const textFile = new File(["hello world"], "test.txt", { type: "text/plain" });
    const result = await compressVideoFile(textFile);
    expect(result.compressed).toBe(false);
    expect(result.file).toBe(textFile);
    expect(result.convertedToH264).toBe(false);
  });

  it("checks WebCodecs environment detection", () => {
    const isSupported = isWebCodecsSupported();
    expect(typeof isSupported).toBe("boolean");
  });

  it("fails gracefully with descriptive error when converting an HEVC video without WebCodecs support", async () => {
    // Mock environment where VideoEncoder / VideoDecoder do not exist
    const origVideoEncoder = (globalThis as unknown as { VideoEncoder?: unknown }).VideoEncoder;
    const origVideoDecoder = (globalThis as unknown as { VideoDecoder?: unknown }).VideoDecoder;
    try {
      delete (globalThis as unknown as { VideoEncoder?: unknown }).VideoEncoder;
      delete (globalThis as unknown as { VideoDecoder?: unknown }).VideoDecoder;

      const fakeMovFile = new File(["fake-hevc-stream"], "clip.mov", {
        type: "video/quicktime",
      });

      await expect(compressVideoFile(fakeMovFile)).rejects.toThrow(
        /QuickTime format, which requires conversion to H.264 MP4/i,
      );
    } finally {
      if (origVideoEncoder) {
        (globalThis as unknown as { VideoEncoder: unknown }).VideoEncoder = origVideoEncoder;
      }
      if (origVideoDecoder) {
        (globalThis as unknown as { VideoDecoder: unknown }).VideoDecoder = origVideoDecoder;
      }
    }
  });

  it("ensures getStoredReels recovers gracefully from 42501 is_blocked error", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    const { supabase } = await import("@/integrations/supabase/client");
    const origFrom = supabase.from;
    (supabase as unknown as { from: unknown }).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: {
              code: "42501",
              message: "permission denied for function is_blocked",
            },
          }),
        }),
      }),
    });

    try {
      const { getStoredReels } = await import("@/services/reelsAndStories");
      const result = await getStoredReels();
      expect(Array.isArray(result)).toBe(true);
    } finally {
      (supabase as unknown as { from: unknown }).from = origFrom;
      globalThis.fetch = origFetch;
    }
  });

  it("ensures addReel inserts without select() to prevent PostgREST is_blocked RLS failure", async () => {
    const origFetch = globalThis.fetch;
    let postRequestUrl = "";
    let postRequestBody = null as Record<string, unknown> | null;

    globalThis.fetch = vi
      .fn()
      .mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes("/rest/v1/reels")) {
          postRequestUrl = urlStr;
          if (init?.body) {
            try {
              postRequestBody = JSON.parse(String(init.body));
            } catch {
              // ignore
            }
          }
          return new Response(null, {
            status: 201,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });

    const testUid = "00000000-0000-4000-8000-000000000001";
    const { supabase } = await import("@/integrations/supabase/client");
    const getSessionSpy = vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          access_token: "test-access-token",
          user: { id: testUid },
        } as unknown as import("@supabase/supabase-js").Session,
      },
      error: null,
    });

    try {
      const { addReel } = await import("@/services/reelsAndStories");
      const mockProfile = {
        id: testUid,
        username: "testuser",
        display_name: "Test User",
        avatar_url: null,
        cover_url: null,
        is_private: false,
        bio: null,
        location: null,
        website: null,
        points_balance: 50,
        status: null,
        theme_preference: "system",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const reel = await addReel(mockProfile, {
        videoUrl: "https://example.com/test.mp4",
        caption: "Test reel",
      });

      expect(postRequestUrl).toContain("/rest/v1/reels");
      // Must NOT contain select= query param which triggers PostgreSQL SELECT policy & is_blocked
      expect(postRequestUrl).not.toContain("select=");
      expect(postRequestBody).toBeDefined();
      expect(postRequestBody?.["id"]).toBeDefined();
      expect(postRequestBody?.["creator_id"]).toBe(testUid);
      expect(reel.id).toBe(postRequestBody?.["id"]);
    } finally {
      getSessionSpy.mockRestore();
      globalThis.fetch = origFetch;
    }
  });
});
