import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Compass,
  Home,
  LogOut,
  Clapperboard,
  User,
  Sparkles,
  Settings,
  Bell,
  Users,
  Bookmark,
  MessageSquare,
  Menu,
  X,
  Plus,
  ShieldAlert,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { myProfileQuery } from "@/services/profiles";
import { getStoredRelationships } from "@/services/social";
import { unreadNotificationsCountQuery, notificationsKeys } from "@/services/notifications";
import { isAdminQuery } from "@/services/moderation";
import { NotificationsModal } from "@/components/social/NotificationsModal";
import { FriendsModal } from "@/components/social/FriendsModal";
import { SavedPostsModal } from "@/components/social/SavedPostsModal";
import { Button } from "@/components/ui/button";

export function AppShell() {
  const { data: me } = useQuery(myProfileQuery());
  const { data: dbUnreadCount = 0 } = useQuery(unreadNotificationsCountQuery());
  const { data: isAdmin = false } = useQuery(isAdminQuery());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [pendingRequests, setPendingRequests] = useState(0);

  function syncSocialCounters() {
    const rel = getStoredRelationships();
    setPendingRequests(rel.incomingFriendRequests.length);
  }

  useEffect(() => {
    syncSocialCounters();

    const handleUpdate = () => syncSocialCounters();
    window.addEventListener("vidalore:social-updated", handleUpdate);

    // Realtime notifications count listener
    const channel = supabase
      .channel("appshell-notifications-counter")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener("vidalore:social-updated", handleUpdate);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const unreadNotifs = dbUnreadCount;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const linkCls =
    "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

  const activeCls = {
    className: "bg-secondary text-[#E91E63] [&_svg]:text-[#E91E63] font-semibold",
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* DESKTOP SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar p-5 md:flex">
        <Link to="/home" className="transition-opacity hover:opacity-95">
          <Logo size="md" />
        </Link>

        <div className="mt-6">
          <Button
            asChild
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-sm"
          >
            <Link to="/create">
              <Plus className="h-4 w-4 stroke-[2.5]" />
              New Post
            </Link>
          </Button>
        </div>

        <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto pr-1" aria-label="Main">
          <Link to="/home" className={linkCls} activeProps={activeCls}>
            <Home className="h-5 w-5" />
            Home
          </Link>

          <Link to="/explore" className={linkCls} activeProps={activeCls}>
            <Compass className="h-5 w-5" />
            Explore
          </Link>

          {/* MESSAGES / INBOX */}
          <Link to="/messages" className={linkCls} activeProps={activeCls}>
            <MessageSquare className="h-5 w-5" />
            Inbox
          </Link>

          {/* REELS */}
          <Link to="/reels" className={linkCls} activeProps={activeCls}>
            <Clapperboard className="h-5 w-5" />
            Reels
          </Link>

          {/* NOTIFICATIONS */}
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="flex items-center justify-between rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <span className="flex items-center gap-3">
              <Bell className="h-5 w-5" />
              Notifications
            </span>

            {unreadNotifs > 0 && (
              <span className="rounded-full bg-[#E91E63] px-2 py-0.5 text-[0.7rem] font-bold text-white">
                {unreadNotifs}
              </span>
            )}
          </button>

          {/* FRIENDS / NETWORK */}
          <button
            type="button"
            onClick={() => setFriendsOpen(true)}
            className="flex items-center justify-between rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <span className="flex items-center gap-3">
              <Users className="h-5 w-5" />
              Network
            </span>

            {pendingRequests > 0 && (
              <span className="rounded-full bg-[#E91E63]/15 px-2 py-0.5 text-[0.7rem] font-bold text-[#E91E63]">
                {pendingRequests} new
              </span>
            )}
          </button>

          {/* SAVED POSTS */}
          <button
            type="button"
            onClick={() => setSavedOpen(true)}
            className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Bookmark className="h-5 w-5" />
            Saved Posts
          </button>

          <Link to="/points" className={linkCls} activeProps={activeCls}>
            <Sparkles className="h-5 w-5 text-[#E91E63]" />
            Points
          </Link>

          {me && (
            <Link
              to="/u/$username"
              params={{ username: me.username }}
              className={linkCls}
              activeProps={activeCls}
            >
              <User className="h-5 w-5" />
              Profile
            </Link>
          )}

          <Link to="/settings/profile" className={linkCls} activeProps={activeCls}>
            <Settings className="h-5 w-5" />
            Settings
          </Link>

          {isAdmin && (
            <Link to="/admin/moderation" className={linkCls} activeProps={activeCls}>
              <ShieldAlert className="h-5 w-5 text-[#E91E63]" />
              Moderation
            </Link>
          )}
        </nav>

        {/* PROFILE FOOTER */}
        {me && (
          <div className="mt-auto flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
            <Link to="/u/$username" params={{ username: me.username }}>
              <UserAvatar profile={me} className="h-9 w-9 shrink-0 ring-1 ring-border" />
            </Link>

            <div className="min-w-0 flex-1">
              <Link to="/u/$username" params={{ username: me.username }}>
                <p className="truncate text-xs font-semibold text-foreground hover:text-[#E91E63] transition-colors">
                  {me.display_name || me.username}
                </p>
              </Link>

              <p className="flex items-center gap-1 text-[0.7rem] font-medium text-muted-foreground">
                <Sparkles className="h-3 w-3 text-[#E91E63]" />
                <span>{me.points_balance} pts</span>
              </p>
            </div>

            <button
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>

      {/* MOBILE TOP HEADER */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md md:hidden">
        <Link to="/home" className="flex items-center">
          <Logo size="sm" />
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            to="/create"
            className="rounded-lg p-2 text-muted-foreground hover:text-[#E91E63] hover:bg-secondary transition-colors"
            aria-label="Create Post"
          >
            <Plus className="h-5 w-5" />
          </Link>

          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifs > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#E91E63] ring-2 ring-background" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setFriendsOpen(true)}
            className="relative rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Network"
          >
            <Users className="h-5 w-5" />
            {pendingRequests > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#E91E63] ring-2 ring-background" />
            )}
          </button>

          <Link
            to="/points"
            className="flex items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:border-[#E91E63]/40 transition-colors"
          >
            <Sparkles className="h-3 w-3 text-[#E91E63]" />
            <span>{me?.points_balance ?? "—"}</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* MOBILE SLIDE-OUT MENU */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex animate-fade-in bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="flex h-full w-4/5 max-w-xs flex-col space-y-4 border-r border-border bg-background p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {me && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <UserAvatar profile={me} className="h-9 w-9 shrink-0 ring-1 ring-border" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{me.display_name || me.username}</p>
                  <p className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-[#E91E63]" />
                    <span>{me.points_balance} pts</span>
                  </p>
                </div>
              </div>
            )}

            <nav className="flex-1 space-y-1 overflow-y-auto">
              <Link
                to="/home"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
              >
                <Home className="h-4 w-4 text-[#E91E63]" />
                Home
              </Link>

              <Link
                to="/explore"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
              >
                <Compass className="h-4 w-4" />
                Explore
              </Link>

              <Link
                to="/messages"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
              >
                <MessageSquare className="h-4 w-4 text-[#E91E63]" />
                Inbox
              </Link>

              <Link
                to="/reels"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
              >
                <Clapperboard className="h-4 w-4" />
                Reels
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setNotificationsOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
              >
                <span className="flex items-center gap-3">
                  <Bell className="h-4 w-4" />
                  Notifications
                </span>
                {unreadNotifs > 0 && (
                  <span className="rounded-full bg-[#E91E63] px-2 py-0.5 text-xs text-white">
                    {unreadNotifs}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setFriendsOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
              >
                <span className="flex items-center gap-3">
                  <Users className="h-4 w-4" />
                  Network
                </span>
                {pendingRequests > 0 && (
                  <span className="rounded-full bg-[#E91E63]/15 px-2 py-0.5 text-xs text-[#E91E63]">
                    {pendingRequests}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSavedOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
              >
                <Bookmark className="h-4 w-4" />
                Saved Posts
              </button>

              <Link
                to="/points"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4 text-[#E91E63]" />
                Points
              </Link>

              {me && (
                <Link
                  to="/u/$username"
                  params={{ username: me.username }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              )}

              <Link
                to="/settings/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>

              {isAdmin && (
                <Link
                  to="/admin/moderation"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary font-medium"
                >
                  <ShieldAlert className="h-4 w-4 text-[#E91E63]" />
                  Moderation
                </Link>
              )}
            </nav>

            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-3 rounded-lg p-2.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="pb-20 md:ml-64 md:pb-8">
        <Outlet />
      </main>

      {/* MOBILE BOTTOM NAVIGATION (5 Destinations: Home, Explore, Reels, Inbox, Profile) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t border-border bg-background/95 px-2 py-1.5 backdrop-blur-lg md:hidden"
      >
        {/* 1. Home */}
        <Link
          to="/home"
          className="flex flex-col items-center justify-center gap-0.5 py-1 text-[0.65rem] text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "text-[#E91E63] [&_svg]:text-[#E91E63] font-semibold" }}
        >
          <Home className="h-5 w-5" />
          <span>Home</span>
        </Link>

        {/* 2. Explore */}
        <Link
          to="/explore"
          className="flex flex-col items-center justify-center gap-0.5 py-1 text-[0.65rem] text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "text-[#E91E63] [&_svg]:text-[#E91E63] font-semibold" }}
        >
          <Compass className="h-5 w-5" />
          <span>Explore</span>
        </Link>

        {/* 3. Reels */}
        <Link
          to="/reels"
          className="flex flex-col items-center justify-center gap-0.5 py-1 text-[0.65rem] text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "text-[#E91E63] [&_svg]:text-[#E91E63] font-semibold" }}
        >
          <Clapperboard className="h-5 w-5" />
          <span>Reels</span>
        </Link>

        {/* 4. Inbox */}
        <Link
          to="/messages"
          className="relative flex flex-col items-center justify-center gap-0.5 py-1 text-[0.65rem] text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "text-[#E91E63] [&_svg]:text-[#E91E63] font-semibold" }}
        >
          <MessageSquare className="h-5 w-5" />
          <span>Inbox</span>
        </Link>

        {/* 5. Profile */}
        {me ? (
          <Link
            to="/u/$username"
            params={{ username: me.username }}
            className="flex flex-col items-center justify-center gap-0.5 py-1 text-[0.65rem] text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-[#E91E63] [&_svg]:text-[#E91E63] font-semibold" }}
          >
            <UserAvatar profile={me} className="h-5 w-5 ring-1 ring-border" />
            <span>Profile</span>
          </Link>
        ) : (
          <span className="flex flex-col items-center justify-center gap-0.5 py-1 text-[0.65rem] text-muted-foreground">
            <User className="h-5 w-5" />
            <span>Profile</span>
          </span>
        )}
      </nav>

      {/* SOCIAL MODALS */}
      <NotificationsModal
        open={notificationsOpen}
        onOpenChange={(v) => {
          setNotificationsOpen(v);
          syncSocialCounters();
        }}
      />

      <FriendsModal
        open={friendsOpen}
        onOpenChange={(v) => {
          setFriendsOpen(v);
          syncSocialCounters();
        }}
        me={me ?? null}
      />

      <SavedPostsModal open={savedOpen} onOpenChange={setSavedOpen} me={me ?? null} />
    </div>
  );
}
