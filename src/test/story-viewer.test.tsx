import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockGetStoryGroups = vi.fn();
const mockMarkStorySeen = vi.fn().mockResolvedValue(undefined);
const mockSendStoryReplyDM = vi.fn().mockResolvedValue({
  conversation: { id: "conv-1" },
  message: { id: "msg-1" },
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href="#profile" onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/services/reelsAndStories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/reelsAndStories")>();
  return {
    ...actual,
    getStoryGroups: (...args: unknown[]) => mockGetStoryGroups(...args),
    markStorySeen: (...args: unknown[]) => mockMarkStorySeen(...args),
    deleteStory: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/services/messages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/messages")>();
  return {
    ...actual,
    sendStoryReplyDM: (...args: unknown[]) => mockSendStoryReplyDM(...args),
  };
});

import { StoriesBar } from "@/components/stories/StoriesBar";

describe("StoriesBar + StoryViewerModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetStoryGroups.mockResolvedValue([
      {
        userId: "user-2",
        username: "creator",
        displayName: "Creator One",
        avatarUrl: null,
        hasUnseen: true,
        stories: [
          {
            id: "story-1",
            userId: "user-2",
            mediaUrl: "https://example.com/story.jpg",
            mediaType: "image",
            caption: "Hello world",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            seenBy: [],
          },
        ],
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("closes viewer after final image story finishes without updating StoriesBar during render", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <StoriesBar
        me={{
          id: "user-1",
          username: "me",
          display_name: "Me",
          avatar_url: null,
          bio: null,
          location: null,
          cover_url: null,
          is_private: false,
          points_balance: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const creatorLabel = screen.getByText("Creator");
    await act(async () => {
      fireEvent.click(creatorLabel);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const setStateDuringRenderCalls = errorSpy.mock.calls.filter((args) =>
      args.some((arg) => typeof arg === "string" && arg.includes("Cannot update a component")),
    );
    expect(setStateDuringRenderCalls).toHaveLength(0);
  });

  it("sends story text replies and quick emoji reactions directly into DMs", async () => {
    render(
      <StoriesBar
        me={{
          id: "user-1",
          username: "me",
          display_name: "Me",
          avatar_url: null,
          bio: null,
          location: null,
          cover_url: null,
          is_private: false,
          points_balance: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Creator"));
    });

    const input = screen.getByPlaceholderText("Reply to Creator One...");
    fireEvent.change(input, { target: { value: "Love this photo!" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    });

    expect(mockSendStoryReplyDM).toHaveBeenCalledWith(
      expect.objectContaining({
        storyId: "story-1",
        ownerId: "user-2",
        ownerUsername: "creator",
        replyText: "Love this photo!",
      }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "React with 🔥" }));
    });

    expect(mockSendStoryReplyDM).toHaveBeenCalledWith(
      expect.objectContaining({
        storyId: "story-1",
        ownerId: "user-2",
        replyText: "🔥",
      }),
    );
  });
});
