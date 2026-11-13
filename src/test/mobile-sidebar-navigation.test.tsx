import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockNavigate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const mockState = vi.hoisted(() => ({
  isAdmin: false,
  profile: {
    id: "user-1",
    username: "annie",
    display_name: "Annie Lee",
    avatar_url: null,
    cover_url: null,
    is_private: false,
    bio: null,
    location: null,
    website: null,
    points_balance: 120,
    status: null,
    theme_preference: "dark",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    onClick,
    className,
  }: {
    to: string;
    children: ReactNode;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    className?: string;
    params?: Record<string, string>;
    activeProps?: Record<string, unknown>;
  }) => (
    <a href={to} onClick={onClick} className={className}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet-content">Outlet</div>,
  useNavigate: () => mockNavigate,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: mockSignOut,
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn().mockResolvedValue("ok"),
    getChannels: vi.fn(() => []),
  },
}));

vi.mock("@/lib/onlinePresence", () => ({
  startOnlinePresence: vi.fn(() => () => {}),
}));

vi.mock("@/services/profiles", () => ({
  myProfileQuery: () => ({
    queryKey: ["profile", "me"],
    queryFn: async () => mockState.profile,
  }),
}));

vi.mock("@/services/notifications", () => ({
  notificationsKeys: { all: ["notifications"] },
  unreadNotificationsCountQuery: () => ({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => 3,
  }),
}));

vi.mock("@/services/moderation", () => ({
  isAdminQuery: () => ({
    queryKey: ["moderation", "is-admin"],
    queryFn: async () => mockState.isAdmin,
  }),
}));

vi.mock("@/services/social", () => ({
  getStoredRelationships: () => ({
    incomingFriendRequests: [],
    friends: [],
    following: [],
    outgoingFriendRequests: [],
  }),
}));

vi.mock("@/components/social/NotificationsModal", () => ({
  NotificationsModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="notifications-modal-open">Notifications Modal Open</div> : null,
}));

vi.mock("@/components/social/FriendsModal", () => ({
  FriendsModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="friends-modal-open">Friends Modal Open</div> : null,
}));

vi.mock("@/components/social/SavedPostsModal", () => ({
  SavedPostsModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="saved-modal-open">Saved Modal Open</div> : null,
}));

vi.mock("@/components/feedback/BetaFeedbackModal", () => ({
  BetaFeedbackModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="feedback-modal-open">Feedback Modal Open</div> : null,
}));

import { AppShell } from "@/components/layout/AppShell";

function renderAppShell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>,
  );
}

describe("AppShell Mobile Sidebar Navigation", () => {
  let historyBackSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.isAdmin = false;
    historyBackSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });

  afterEach(() => {
    historyBackSpy.mockRestore();
  });

  it("navigates to every route item from the mobile menu, closes the menu, and never triggers window.history.back()", async () => {
    mockState.isAdmin = true;
    renderAppShell();

    await waitFor(() => {
      expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);
    });

    const routeExpectations: Array<{ label: string; to: string; params?: Record<string, string> }> =
      [
        { label: "Home", to: "/home" },
        { label: "Explore", to: "/explore" },
        { label: "Inbox", to: "/messages" },
        { label: "Reels", to: "/reels" },
        { label: "Games Center", to: "/games" },
        { label: "Points", to: "/points" },
        { label: "Profile", to: "/u/$username", params: { username: "annie" } },
        { label: "Settings", to: "/settings/profile" },
        { label: "Admin Console", to: "/admin" },
      ];

    for (const item of routeExpectations) {
      fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
      const dialog = screen.getByRole("dialog", { name: "Mobile Navigation Menu" });
      const navLink = Array.from(dialog.querySelectorAll("a")).find(
        (el) => el.textContent?.trim() === item.label,
      );
      expect(navLink).toBeDefined();

      fireEvent.click(navLink!);
      await act(async () => {
        await Promise.resolve();
      });

      expect(
        screen.queryByRole("dialog", { name: "Mobile Navigation Menu" }),
      ).not.toBeInTheDocument();

      if (item.params) {
        expect(mockNavigate).toHaveBeenLastCalledWith({ to: item.to, params: item.params });
      } else {
        expect(mockNavigate).toHaveBeenLastCalledWith({ to: item.to });
      }
    }

    expect(historyBackSpy).not.toHaveBeenCalled();
  });

  it("hides Admin Console for non-admin users", async () => {
    mockState.isAdmin = false;
    renderAppShell();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const dialog = screen.getByRole("dialog", { name: "Mobile Navigation Menu" });
    const adminLink = Array.from(dialog.querySelectorAll("a")).find((el) =>
      el.textContent?.includes("Admin Console"),
    );
    expect(adminLink).toBeUndefined();
  });

  it("opens Notifications, Network, Saved Posts, and Beta Feedback modals from mobile menu without closing them via history.back()", async () => {
    renderAppShell();

    const modalCases = [
      { label: "Notifications", testId: "notifications-modal-open" },
      { label: "Network", testId: "friends-modal-open" },
      { label: "Saved Posts", testId: "saved-modal-open" },
      { label: "Beta Feedback", testId: "feedback-modal-open" },
    ];

    for (const modalCase of modalCases) {
      fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
      const dialog = screen.getByRole("dialog", { name: "Mobile Navigation Menu" });
      const button = Array.from(dialog.querySelectorAll("button")).find((el) =>
        el.textContent?.includes(modalCase.label),
      );
      expect(button).toBeDefined();

      fireEvent.click(button!);
      await act(async () => {
        await Promise.resolve();
      });

      expect(
        screen.queryByRole("dialog", { name: "Mobile Navigation Menu" }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId(modalCase.testId)).toBeInTheDocument();
    }

    expect(historyBackSpy).not.toHaveBeenCalled();
  });

  it("signs out, closes the mobile menu, and navigates to / without calling window.history.back()", async () => {
    renderAppShell();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const dialog = screen.getByRole("dialog", { name: "Mobile Navigation Menu" });
    const signOutBtn = Array.from(dialog.querySelectorAll("button")).find((el) =>
      el.textContent?.includes("Sign out"),
    );
    expect(signOutBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(signOutBtn!);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/", replace: true });
    });

    expect(
      screen.queryByRole("dialog", { name: "Mobile Navigation Menu" }),
    ).not.toBeInTheDocument();
    expect(historyBackSpy).not.toHaveBeenCalled();
  });

  it("closes the mobile menu when Android/Browser Back (popstate) fires", () => {
    renderAppShell();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(screen.getByRole("dialog", { name: "Mobile Navigation Menu" })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(
      screen.queryByRole("dialog", { name: "Mobile Navigation Menu" }),
    ).not.toBeInTheDocument();
  });
});
