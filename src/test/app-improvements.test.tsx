import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockNavigate = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: {
      from: () => ({
        createSignedUrl: (...args: unknown[]) => mockStorageCreateSignedUrl(...args),
      }),
    },
  },
}));

vi.mock("@/services/profiles", () => ({
  checkUsernameAvailable: vi.fn().mockResolvedValue(true),
  friendlyAuthError: (msg: string) => msg,
}));

import { LandingPage } from "@/routes/index";
import { DownloadAppButton } from "@/components/pwa/DownloadAppButton";
import { __resetPWAInstallStateForTests, initPWAInstallListener } from "@/lib/pwaInstall";
import { getStoredMutedPreference, setStoredMutedPreference } from "@/lib/videoAudioPreference";
import {
  encodeStoryReplyContent,
  parseStoryReplyMessage,
  formatMessageTextForPreview,
  resolveStoryPreview,
} from "@/lib/storyReplyPayload";
import { sendStoryReplyDM } from "@/services/messages";

describe("VIDALORE SOCIAL — Registration, PWA Download, Sound & Story Reply DM", () => {
  let authCallback: ((event: string, session: unknown) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    __resetPWAInstallStateForTests();
    authCallback = null;

    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSignOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1 & 2. Registration Success Screen & Manual Login Enforcement", () => {
    it("never auto-logs in after registration, signs out any created session, and shows Download App + Login buttons", async () => {
      vi.useFakeTimers();

      mockSignUp.mockImplementation(async () => {
        const fakeSession = { user: { id: "new-user-1" }, access_token: "token" };
        // Simulate Supabase emitting SIGNED_IN during signUp
        authCallback?.("SIGNED_IN", fakeSession);
        return { data: { user: { id: "new-user-1" }, session: fakeSession }, error: null };
      });

      render(<LandingPage />);

      // Switch to Create account tab
      fireEvent.click(screen.getByRole("tab", { name: "Create account" }));

      fireEvent.change(screen.getByLabelText("Username"), { target: { value: "rose_creator" } });
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });

      fireEvent.change(screen.getByLabelText("Display name"), {
        target: { value: "Rose Creator" },
      });
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "rose@example.com" } });
      fireEvent.change(screen.getByLabelText("Password (8+ characters)"), {
        target: { value: "StrongPass123!" },
      });

      vi.useRealTimers();

      await act(async () => {
        const submitBtn = screen.getByRole("button", { name: /Create account/i });
        fireEvent.submit(submitBtn.closest("form")!);
      });

      // Must explicitly clear auto-created session and NEVER navigate to /home
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/home", replace: true });

      // Confirmation screen renders welcome, Download App CTA, and manual Login button
      expect(screen.getByText(/Welcome to VIDALORE SOCIAL, Rose Creator!/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Download VIDALORE SOCIAL App/i }),
      ).toBeInTheDocument();
      const loginBtn = screen.getByRole("button", { name: /Login to your account/i });
      expect(loginBtn).toBeInTheDocument();

      // Clicking Login returns to manual sign-in form and allows manual login
      fireEvent.click(loginBtn);
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();

      mockSignInWithPassword.mockResolvedValue({
        data: { session: { user: { id: "new-user-1" } } },
        error: null,
      });
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "rose@example.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPass123!" } });

      await act(async () => {
        const signInBtn = screen.getByRole("button", { name: "Sign in" });
        fireEvent.submit(signInBtn.closest("form")!);
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "rose@example.com",
        password: "StrongPass123!",
      });
    });
  });

  describe("3. PWA Download / Install Flow", () => {
    it("triggers captured beforeinstallprompt on Android/Chromium browsers", async () => {
      initPWAInstallListener();
      const promptMock = vi.fn().mockResolvedValue(undefined);
      const installEvent = new Event("beforeinstallprompt") as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
      };
      installEvent.prompt = promptMock;
      installEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });

      act(() => {
        window.dispatchEvent(installEvent);
      });

      render(<DownloadAppButton />);

      const downloadBtn = screen.getByRole("button", { name: /Download VIDALORE SOCIAL App/i });
      await act(async () => {
        fireEvent.click(downloadBtn);
      });

      expect(promptMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/VIDALORE SOCIAL App Installed/i)).toBeInTheDocument();
    });

    it("detects when app is already installed in standalone mode", () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("standalone"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })) as unknown as typeof window.matchMedia;

      try {
        render(<DownloadAppButton />);
        expect(screen.getByText(/VIDALORE SOCIAL App Installed/i)).toBeInTheDocument();
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });
  });

  describe("4. Persistent Video Audio Preference", () => {
    it("defaults to unmuted and persists user toggles across calls", () => {
      expect(getStoredMutedPreference()).toBe(false);
      setStoredMutedPreference(true);
      expect(getStoredMutedPreference()).toBe(true);
      setStoredMutedPreference(false);
      expect(getStoredMutedPreference()).toBe(false);
    });
  });

  describe("5. Story Replies to Direct Messages", () => {
    it("encodes, parses, and creates clean preview snippets without leaking raw markers", () => {
      const encoded = encodeStoryReplyContent(
        {
          storyId: "story-abc",
          ownerId: "owner-2",
          ownerUsername: "claire",
          mediaType: "image",
          mediaPath: "owner-2/photo.jpg",
          caption: "Sunset vibes",
        },
        "Incredible view!",
      );

      const parsed = parseStoryReplyMessage(encoded);
      expect(parsed).not.toBeNull();
      expect(parsed?.storyRef.storyId).toBe("story-abc");
      expect(parsed?.storyRef.ownerUsername).toBe("claire");
      expect(parsed?.replyText).toBe("Incredible view!");
      expect(formatMessageTextForPreview(encoded)).toBe("Story reply: Incredible view!");
    });

    it("reuses/creates 1-on-1 DM conversation and sends message when replying to a story", async () => {
      const insertedPayloads: Array<Record<string, unknown>> = [];
      const sentRow = {
        id: "msg-101",
        conversation_id: "conv-direct-1",
        sender_id: "user-1",
        content: "encoded",
        message_type: "text",
      };

      let membershipCall = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "conversation_members") {
          membershipCall += 1;
          if (membershipCall === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ conversation_id: "conv-direct-1" }],
                  error: null,
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ conversation_id: "conv-direct-1" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: "conv-direct-1", kind: "direct" },
                      error: null,
                    }),
                  }),
                }),
                single: vi.fn().mockResolvedValue({
                  data: { id: "conv-direct-1", kind: "direct" },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === "messages") {
          return {
            insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              insertedPayloads.push(payload);
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: sentRow, error: null }),
                }),
              };
            }),
          };
        }
        return {};
      });

      const result = await sendStoryReplyDM({
        storyId: "story-1",
        ownerId: "user-2",
        ownerUsername: "creator",
        mediaType: "image",
        mediaPath: "user-2/story.jpg",
        replyText: "Love this!",
      });

      expect(result.conversation.id).toBe("conv-direct-1");
      expect(result.message.id).toBe("msg-101");
      expect(insertedPayloads).toHaveLength(1);
      expect(insertedPayloads[0]?.["conversation_id"]).toBe("conv-direct-1");
      expect(insertedPayloads[0]?.["message_type"]).toBe("text");
      expect(String(insertedPayloads[0]?.["content"])).toContain("story-1");
      expect(String(insertedPayloads[0]?.["content"])).toContain("Love this!");
    });

    it("blocks sending a story reply DM to oneself", async () => {
      await expect(
        sendStoryReplyDM({
          storyId: "story-1",
          ownerId: "user-1",
          ownerUsername: "me",
          mediaType: "image",
          replyText: "Self reply",
        }),
      ).rejects.toThrow("You cannot reply to your own story.");
    });

    it("resolves active story previews and gracefully handles expired/deleted stories", async () => {
      const expired = await resolveStoryPreview({
        storyId: "story-exp",
        ownerId: "user-2",
        ownerUsername: "creator",
        mediaType: "image",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      });
      expect(expired.available).toBe(false);
      expect(expired.reason).toBe("expired");

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });
      const deleted = await resolveStoryPreview({
        storyId: "story-del",
        ownerId: "user-2",
        ownerUsername: "creator",
        mediaType: "image",
      });
      expect(deleted.available).toBe(false);
      expect(deleted.reason).toBe("deleted");

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "story-live",
                media_url: "user-2/live.mp4",
                media_type: "video",
                caption: "Live moment",
                expires_at: new Date(Date.now() + 3600_000).toISOString(),
              },
              error: null,
            }),
          }),
        }),
      });
      mockStorageCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: "https://storage.mock/live.mp4" },
        error: null,
      });

      const active = await resolveStoryPreview({
        storyId: "story-live",
        ownerId: "user-2",
        ownerUsername: "creator",
        mediaType: "video",
      });
      expect(active.available).toBe(true);
      expect(active.mediaUrl).toBe("https://storage.mock/live.mp4");
      expect(active.mediaType).toBe("video");
    });
  });
});
