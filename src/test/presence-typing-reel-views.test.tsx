import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

type ChannelCallback = (payload?: unknown) => void;

interface MockChannel {
  topic: string;
  handlers: Array<{ type: string; event: string; cb: ChannelCallback }>;
  presenceData: Record<string, unknown[]>;
  subscribeStatusCb: ((status: string) => void | Promise<void>) | null;
  track: ReturnType<typeof vi.fn>;
  untrack: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  presenceState: () => Record<string, unknown[]>;
  on: (type: string, filter: { event?: string }, cb: ChannelCallback) => MockChannel;
  subscribe: (cb?: (status: string) => void | Promise<void>) => MockChannel;
  trigger: (type: string, event: string, payload?: unknown) => void;
}

const mockChannels: MockChannel[] = [];
const mockRpc = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockRemoveChannel = vi.fn();

function createMockChannel(topic: string): MockChannel {
  const ch: MockChannel = {
    topic,
    handlers: [],
    presenceData: {},
    subscribeStatusCb: null,
    track: vi.fn().mockResolvedValue("ok"),
    untrack: vi.fn().mockResolvedValue("ok"),
    send: vi.fn().mockResolvedValue("ok"),
    presenceState: () => ch.presenceData,
    on(type, filter, cb) {
      ch.handlers.push({ type, event: filter?.event ?? "*", cb });
      return ch;
    },
    subscribe(cb) {
      ch.subscribeStatusCb = cb ?? null;
      if (cb) {
        void cb("SUBSCRIBED");
      }
      return ch;
    },
    trigger(type, event, payload) {
      for (const h of ch.handlers) {
        if (h.type === type && (h.event === event || h.event === "*")) {
          h.cb(payload);
        }
      }
    },
  };
  mockChannels.push(ch);
  return ch;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
    rpc: mockRpc,
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
    channel: vi.fn((name: string) => createMockChannel(`realtime:${name}`)),
    getChannels: vi.fn(() => mockChannels),
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/services/relationships", () => ({
  followUser: vi.fn().mockResolvedValue(undefined),
  unfollowUser: vi.fn().mockResolvedValue(undefined),
  isFollowing: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/components/reels/ReelCommentsDrawer", () => ({
  ReelCommentsDrawer: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => (
    <a href={props.to ?? "#"}>{children}</a>
  ),
}));

describe("Real-Time Presence, Typing Indicators, Delivery States & Reel Views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChannels.length = 0;
    window.localStorage.clear();
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1", email: "user1@vidalore.com" },
          access_token: "token-1",
        },
      },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user1@vidalore.com" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  afterEach(async () => {
    vi.useRealTimers();
    const { __resetOnlinePresenceForTests } = await import("@/lib/onlinePresence");
    __resetOnlinePresenceForTests();
    const { __resetRecordedReelViewsForTests } = await import("@/services/reelsAndStories");
    __resetRecordedReelViewsForTests();
  });

  describe("Part 1: Online Presence & Last Seen", () => {
    it("formats last seen labels across all human-readable time ranges", async () => {
      const { formatLastSeen } = await import("@/lib/onlinePresence");
      const now = new Date("2026-05-10T14:30:00.000Z").getTime();

      expect(formatLastSeen(null, now)).toBe("Offline");
      expect(formatLastSeen("not-a-date", now)).toBe("Offline");
      expect(formatLastSeen("2026-05-10T14:29:40.000Z", now)).toBe("Last seen just now");
      expect(formatLastSeen("2026-05-10T14:29:00.000Z", now)).toBe("Last seen 1 minute ago");
      expect(formatLastSeen("2026-05-10T14:25:00.000Z", now)).toBe("Last seen 5 minutes ago");
      expect(formatLastSeen("2026-05-10T12:30:00.000Z", now)).toBe("Last seen 2 hours ago");
      expect(formatLastSeen("2026-05-09T18:00:00.000Z", now)).toBe("Last seen yesterday");
      expect(formatLastSeen("2026-05-07T10:00:00.000Z", now)).toBe("Last seen 3 days ago");
    });

    it("tracks presence join/leave, network offline/online, and page unload", async () => {
      const {
        startOnlinePresence,
        isUserCurrentlyOnline,
        getEffectiveLastSeen,
        seedProfileLastSeen,
        extractProfileLastSeen,
      } = await import("@/lib/onlinePresence");

      seedProfileLastSeen([{ id: "peer-2", last_seen_at: "2026-05-10T10:00:00.000Z" }]);
      expect(
        extractProfileLastSeen({ id: "peer-2", last_seen_at: "2026-05-10T10:00:00.000Z" }),
      ).toBe("2026-05-10T10:00:00.000Z");

      const stop = startOnlinePresence({ id: "user-1", username: "alex" });
      expect(isUserCurrentlyOnline("user-1")).toBe(true);
      expect(isUserCurrentlyOnline("peer-2")).toBe(false);

      const channel = mockChannels.find((c) => c.topic === "realtime:vidalore:online-presence");
      expect(channel).toBeDefined();
      expect(channel?.track).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", username: "alex" }),
      );

      // Peer joins
      channel!.presenceData = { "user-1": [{}], "peer-2": [{}] };
      channel!.trigger("presence", "join", { key: "peer-2" });
      expect(isUserCurrentlyOnline("peer-2")).toBe(true);

      // Peer leaves completely -> removed from online & last-seen updated
      channel!.presenceData = { "user-1": [{}] };
      channel!.trigger("presence", "leave", { key: "peer-2" });
      expect(isUserCurrentlyOnline("peer-2")).toBe(false);
      expect(getEffectiveLastSeen("peer-2")).toBeTruthy();

      // Browser network offline / online
      window.dispatchEvent(new Event("offline"));
      expect(isUserCurrentlyOnline("user-1")).toBe(false);

      window.dispatchEvent(new Event("online"));
      expect(isUserCurrentlyOnline("user-1")).toBe(true);

      const reconnectedChannel = [...mockChannels]
        .reverse()
        .find((c) => c.topic === "realtime:vidalore:online-presence");

      // Tab close / pagehide untracks immediately on active channel
      window.dispatchEvent(new Event("pagehide"));
      expect(reconnectedChannel?.untrack).toHaveBeenCalled();

      stop();
      expect(isUserCurrentlyOnline("user-1")).toBe(false);
    });

    it("renders PresenceDot and PresenceStatusText with correct online/offline styles", async () => {
      const { PresenceDot, PresenceStatusText } =
        await import("@/components/social/PresenceIndicator");

      const { rerender } = render(<PresenceDot isOnline={true} />);
      const dot = screen.getByRole("status", { name: "Online" });
      expect(dot.className).toContain("bg-[#22C55E]");

      rerender(<PresenceDot isOnline={false} lastSeenAt={null} />);
      const offlineDot = screen.getByRole("status", { name: "Offline" });
      expect(offlineDot.className).toContain("bg-zinc-500");

      render(<PresenceStatusText isOnline={true} showDot />);
      expect(screen.getByText("Online")).toBeInTheDocument();
    });
  });

  describe("Part 2: Typing Indicator & Message Delivery States", () => {
    it("throttles typing broadcasts and clears on empty text, blur, send, and unmount", async () => {
      vi.useFakeTimers();
      const { ChatComposer } = await import("@/components/messages/ChatComposer");

      const onTyping = vi.fn();
      const onSendMessage = vi.fn().mockResolvedValue(undefined);

      const { unmount } = render(
        <ChatComposer
          onSendMessage={onSendMessage}
          onTyping={onTyping}
          replyingTo={null}
          editingMessage={null}
          onCancelReply={vi.fn()}
          onCancelEdit={vi.fn()}
          isSending={false}
        />,
      );

      const textarea = screen.getByPlaceholderText(/Write a message/i);

      // First keystroke emits typing=true immediately
      fireEvent.change(textarea, { target: { value: "H" } });
      expect(onTyping).toHaveBeenCalledTimes(1);
      expect(onTyping).toHaveBeenLastCalledWith(true);

      // Rapid keystrokes within 1500ms are throttled
      fireEvent.change(textarea, { target: { value: "He" } });
      fireEvent.change(textarea, { target: { value: "Hel" } });
      expect(onTyping).toHaveBeenCalledTimes(1);

      // After 1500ms another keystroke broadcasts again
      act(() => {
        vi.advanceTimersByTime(1600);
      });
      fireEvent.change(textarea, { target: { value: "Hell" } });
      expect(onTyping).toHaveBeenCalledTimes(2);
      expect(onTyping).toHaveBeenLastCalledWith(true);

      // After 2500ms inactivity, emits typing=false
      act(() => {
        vi.advanceTimersByTime(2600);
      });
      expect(onTyping).toHaveBeenLastCalledWith(false);

      // Clearing input clears typing immediately
      fireEvent.change(textarea, { target: { value: "Hi" } });
      expect(onTyping).toHaveBeenLastCalledWith(true);
      fireEvent.change(textarea, { target: { value: "   " } });
      expect(onTyping).toHaveBeenLastCalledWith(false);

      // Blur clears typing immediately
      fireEvent.change(textarea, { target: { value: "Test" } });
      expect(onTyping).toHaveBeenLastCalledWith(true);
      fireEvent.blur(textarea);
      expect(onTyping).toHaveBeenLastCalledWith(false);

      // Unmount while typing clears typing
      fireEvent.change(textarea, { target: { value: "Unmounting..." } });
      expect(onTyping).toHaveBeenLastCalledWith(true);
      unmount();
      expect(onTyping).toHaveBeenLastCalledWith(false);
    });

    it("handles typing broadcasts, peer leave cleanup, and member read updates on conversation channel", async () => {
      const { subscribeToConversationChannel } = await import("@/services/messages");

      const onTyping = vi.fn();
      const onPeerLeave = vi.fn();
      const onMemberReadUpdate = vi.fn();

      const sub = subscribeToConversationChannel("conv-1", "user-1", {
        onTyping,
        onPeerLeave,
        onMemberReadUpdate,
      });

      const ch = mockChannels.find((c) => c.topic === "realtime:conv-room-conv-1");
      expect(ch).toBeDefined();

      sub.sendTyping(true, "Alex");
      expect(ch?.send).toHaveBeenCalledWith({
        type: "broadcast",
        event: "typing",
        payload: { userId: "user-1", username: "Alex", isTyping: true },
      });

      // Incoming typing broadcast
      ch?.trigger("broadcast", "typing", {
        payload: { userId: "user-2", username: "Jordan", isTyping: true },
      });
      expect(onTyping).toHaveBeenCalledWith({
        userId: "user-2",
        username: "Jordan",
        isTyping: true,
      });

      // Peer disconnects without sending typing=false
      ch!.presenceData = {};
      ch?.trigger("presence", "leave", { key: "user-2" });
      expect(onPeerLeave).toHaveBeenCalledWith("user-2");

      // Peer updates last_read_at
      ch?.trigger("postgres_changes", "UPDATE", {
        new: { user_id: "user-2", last_read_at: "2026-05-10T15:00:00.000Z" },
      });
      expect(onMemberReadUpdate).toHaveBeenCalledWith({
        userId: "user-2",
        lastReadAt: "2026-05-10T15:00:00.000Z",
      });

      sub.unsubscribe();
    });

    it("displays 'Typing...', 'Online', and 'Last seen' states in ChatHeader", async () => {
      const { ChatHeader } = await import("@/components/messages/ChatHeader");

      const directConversation = {
        id: "conv-1",
        kind: "direct" as const,
        title: null,
        image_url: null,
        created_by: "user-1",
        created_at: "2026-05-01T00:00:00.000Z",
        last_message_at: "2026-05-10T10:00:00.000Z",
        members: [
          {
            conversation_id: "conv-1",
            user_id: "user-1",
            role: "member",
            joined_at: "2026-05-01T00:00:00.000Z",
            last_read_at: null,
            profile: { id: "user-1", username: "alex", display_name: "Alex", avatar_url: null },
          },
          {
            conversation_id: "conv-1",
            user_id: "user-2",
            role: "member",
            joined_at: "2026-05-01T00:00:00.000Z",
            last_read_at: null,
            profile: { id: "user-2", username: "jordan", display_name: "Jordan", avatar_url: null },
          },
        ],
        lastMessage: null,
      } as unknown as Parameters<typeof ChatHeader>[0]["conversation"];

      const { rerender } = render(
        <ChatHeader
          conversation={directConversation}
          currentUserId="user-1"
          isOnline={true}
          lastSeenAt={null}
          typingUsers={[]}
          onBack={vi.fn()}
          onOpenDetails={vi.fn()}
        />,
      );

      expect(screen.getByText("Online")).toBeInTheDocument();

      rerender(
        <ChatHeader
          conversation={directConversation}
          currentUserId="user-1"
          isOnline={true}
          lastSeenAt={null}
          typingUsers={["Jordan"]}
          onBack={vi.fn()}
          onOpenDetails={vi.fn()}
        />,
      );
      expect(screen.getByText("Typing...")).toBeInTheDocument();

      rerender(
        <ChatHeader
          conversation={directConversation}
          currentUserId="user-1"
          isOnline={false}
          lastSeenAt={new Date(Date.now() - 5 * 60 * 1000).toISOString()}
          typingUsers={[]}
          onBack={vi.fn()}
          onOpenDetails={vi.fn()}
        />,
      );
      expect(screen.getByText("Last seen 5 minutes ago")).toBeInTheDocument();
    });

    it("renders Sending..., Failed to send (with Retry/Dismiss), Sent, and Seen states on MessageItem", async () => {
      const { MessageItem } = await import("@/components/messages/MessageItem");

      const baseMsg = {
        id: "msg-1",
        conversation_id: "conv-1",
        sender_id: "user-1",
        content: "Hello world",
        message_type: "text" as const,
        media_url: null,
        media_name: null,
        reply_to_id: null,
        edited_at: null,
        deleted_at: null,
        created_at: "2026-05-10T12:00:00.000Z",
        reads: [],
        reactions: [],
      };

      const onRetry = vi.fn();
      const onDismissFailed = vi.fn();

      const { rerender } = render(
        <MessageItem
          message={{ ...baseMsg, localStatus: "sending" }}
          currentUserId="user-1"
          isGroup={false}
          isAdmin={false}
          onReply={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onToggleReaction={vi.fn()}
        />,
      );
      expect(screen.getByText("Sending...")).toBeInTheDocument();

      rerender(
        <MessageItem
          message={{ ...baseMsg, localStatus: "failed", localError: "Network timeout" }}
          currentUserId="user-1"
          isGroup={false}
          isAdmin={false}
          onReply={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onToggleReaction={vi.fn()}
          onRetry={onRetry}
          onDismissFailed={onDismissFailed}
        />,
      );
      expect(screen.getByText("Failed to send")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Retry"));
      expect(onRetry).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: "Dismiss failed message" }));
      expect(onDismissFailed).toHaveBeenCalledWith("msg-1");

      rerender(
        <MessageItem
          message={baseMsg}
          currentUserId="user-1"
          isGroup={false}
          isAdmin={false}
          peerLastReadAt="2026-05-10T11:59:00.000Z"
          onReply={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onToggleReaction={vi.fn()}
        />,
      );
      expect(screen.getByText("Sent")).toBeInTheDocument();

      rerender(
        <MessageItem
          message={baseMsg}
          currentUserId="user-1"
          isGroup={false}
          isAdmin={false}
          peerLastReadAt="2026-05-10T12:01:00.000Z"
          onReply={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onToggleReaction={vi.fn()}
        />,
      );
      expect(screen.getByText("Seen")).toBeInTheDocument();
    });
  });

  describe("Part 3: Reel Views Accuracy & 2-Second Playback Threshold", () => {
    it("deduplicates concurrent and repeat recordReelView calls and requires authentication", async () => {
      const { recordReelView, __resetRecordedReelViewsForTests } =
        await import("@/services/reelsAndStories");

      // Unauthenticated user cannot record view
      mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });
      await expect(recordReelView("reel-1")).rejects.toThrow(/sign in/i);

      // Rejects blank reel ID
      await expect(recordReelView("   ")).rejects.toThrow(/valid Reel ID/i);

      // Sub-threshold watch duration must NOT invoke the RPC
      const earlyResult = await recordReelView("reel-1", { watchedMs: 1999 });
      expect(earlyResult).toBe(0);
      expect(mockRpc).not.toHaveBeenCalled();

      // Concurrent calls coalesce into a single RPC invocation
      mockRpc.mockResolvedValueOnce({ data: 42, error: null });
      const [first, second] = await Promise.all([
        recordReelView("reel-1", { watchedMs: 2000 }),
        recordReelView("reel-1", { watchedMs: 2500 }),
      ]);
      expect(first).toBe(42);
      expect(second).toBe(42);
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("record_reel_view", { _reel_id: "reel-1" });

      // Subsequent call in same session returns cached authoritative count without extra RPC
      const third = await recordReelView("reel-1");
      expect(third).toBe(42);
      expect(mockRpc).toHaveBeenCalledTimes(1);

      __resetRecordedReelViewsForTests();
    });

    it("waits for 2 seconds of active playback before counting ReelPlayer view and never double-counts loops/re-renders", async () => {
      vi.useFakeTimers();
      mockRpc.mockResolvedValue({ data: 11, error: null });

      const playMock = vi.fn().mockResolvedValue(undefined);
      const pauseMock = vi.fn();

      Object.defineProperty(HTMLMediaElement.prototype, "play", {
        configurable: true,
        value: function play(this: HTMLMediaElement) {
          Object.defineProperty(this, "paused", { configurable: true, value: false });
          return playMock();
        },
      });
      Object.defineProperty(HTMLMediaElement.prototype, "pause", {
        configurable: true,
        value: function pause(this: HTMLMediaElement) {
          Object.defineProperty(this, "paused", { configurable: true, value: true });
          return pauseMock();
        },
      });

      const { ReelPlayer } = await import("@/components/reels/ReelPlayer");

      const sampleReel = {
        id: "reel-threshold-1",
        creatorId: "creator-1",
        creatorName: "Creator",
        creatorUsername: "creator",
        videoUrl: "https://example.com/video.mp4",
        caption: "Testing view threshold",
        likesCount: 5,
        commentsCount: 2,
        sharesCount: 1,
        savesCount: 0,
        viewsCount: 10,
        createdAt: "2026-05-10T10:00:00.000Z",
      };

      const meProfile = {
        id: "user-1",
        username: "alex",
        display_name: "Alex",
        avatar_url: null,
        bio: null,
        location: null,
        cover_url: null,
        is_private: false,
        points_balance: 100,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      };

      const { container, rerender } = render(
        <ReelPlayer
          reel={sampleReel}
          isActive={true}
          isMuted={true}
          onToggleMute={vi.fn()}
          me={meProfile}
        />,
      );

      const video = container.querySelector("video")!;
      Object.defineProperty(video, "paused", { configurable: true, value: false });
      Object.defineProperty(video, "ended", { configurable: true, value: false });

      // Simulate video started playing
      fireEvent.playing(video);

      // Before 2s (< 2000ms), should NOT have called record_reel_view
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1200);
      });
      expect(mockRpc).not.toHaveBeenCalled();

      // Click video while playing to pause for 3 seconds — paused time must NOT count
      fireEvent.click(video);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(mockRpc).not.toHaveBeenCalled();

      // Click again to resume playback for remaining ~1s to cross 2000ms total active playback
      fireEvent.click(video);
      fireEvent.playing(video);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("record_reel_view", {
        _reel_id: "reel-threshold-1",
      });

      // Authoritative count (11) renders in UI
      vi.useRealTimers();
      await waitFor(() => {
        expect(screen.getByText("11")).toBeInTheDocument();
      });

      // Looping and re-rendering with updated prop reference must NOT double-count
      fireEvent.ended(video);
      fireEvent.playing(video);
      rerender(
        <ReelPlayer
          reel={{ ...sampleReel, likesCount: 6 }}
          isActive={true}
          isMuted={true}
          onToggleMute={vi.fn()}
          me={meProfile}
        />,
      );
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });
  });
});
