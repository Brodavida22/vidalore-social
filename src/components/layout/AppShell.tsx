import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Compass,
  Home,
  LogOut,
  PlusSquare,
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
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { myProfileQuery } from "@/services/profiles";
import {
  getStoredNotifications,
  getStoredRelationships,
} from "@/services/social";
import { NotificationsModal } from "@/components/social/NotificationsModal";
import { FriendsModal } from "@/components/social/FriendsModal";
import { SavedPostsModal } from "@/components/social/SavedPostsModal";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/create", label: "Create", icon: PlusSquare },
  { to: "/reels", label: "Reels", icon: Clapperboard },
] as const;

export function AppShell() {
  const { data: me } = useQuery(myProfileQuery());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  function syncSocialCounters() {
    const notifs = getStoredNotifications();
    setUnreadNotifs(notifs.filter((n) => !n.isRead).length);

    const rel = getStoredRelationships();
    setPendingRequests(rel.incomingFriendRequests.length);
  }

  useEffect(() => {
    syncSocialCounters();

    const handleUpdate = () => syncSocialCounters();

    window.addEventListener("vidalore:social-updated", handleUpdate);

    return () =>
      window.removeEventListener("vidalore:social-updated", handleUpdate);
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const linkCls =
    "flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground";

  const activeCls = {
    className:
      "bg-secondary text-foreground [&_svg]:text-primary font-semibold shadow-sm",
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* DESKTOP SIDEBAR */}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/80 bg-sidebar p-5 md:flex">
        <Link to="/home" className="transition-opacity hover:opacity-95">
          <Logo />
        </Link>

        <div className="mt-6">
          <Button
            asChild
            variant="rose"
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-5 text-sm font-semibold shadow-glow"
          >
            <Link to="/create">
              <Plus className="h-4 w-4" />
              Plant a Moment 🌹
            </Link>
          </Button>
        </div>

        <nav
          className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto pr-1"
          aria-label="Main"
        >
          <Link to="/home" className={linkCls} activeProps={activeCls}>
            <Home className="h-5 w-5" />
            Home
          </Link>

          <Link to="/explore" className={linkCls} activeProps={activeCls}>
            <Compass className="h-5 w-5" />
            Explore
          </Link>

          {/* MESSAGES */}

          <Link to="/messages" className={linkCls} activeProps={activeCls}>
            <MessageSquare className="h-5 w-5" />
            Messages
          </Link>

          {/* NOTIFICATIONS */}

          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="flex items-center justify-between rounded-2xl px-4 py-2.5 text-left text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
          >
            <span className="flex items-center gap-3">
              <Bell className="h-5 w-5" />
              Notifications
            </span>

            {unreadNotifs > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold text-primary-foreground shadow-glow">
                {unreadNotifs}
              </span>
            )}
          </button>

          {/* FRIENDS */}

          <button
            type="button"
            onClick={() => setFriendsOpen(true)}
            className="flex items-center justify-between rounded-2xl px-4 py-2.5 text-left text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
          >
            <span className="flex items-center gap-3">
              <Users className="h-5 w-5" />
              Garden Circle
            </span>

            {pendingRequests > 0 && (
              <span className="rounded-full bg-rose-soft/20 px-2 py-0.5 text-[0.7rem] font-bold text-rose-soft">
                {pendingRequests} new
              </span>
            )}
          </button>

          {/* SAVED POSTS */}

          <button
            type="button"
            onClick={() => setSavedOpen(true)}
            className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
          >
            <Bookmark className="h-5 w-5" />
            Saved Moments
          </button>

          <Link to="/reels" className={linkCls} activeProps={activeCls}>
            <Clapperboard className="h-5 w-5" />
            Reels
          </Link>

          <Link to="/points" className={linkCls} activeProps={activeCls}>
            <Sparkles className="h-5 w-5 text-rose-soft" />
            VIDA POINTS
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

          <Link
            to="/settings/profile"
            className={linkCls}
            activeProps={activeCls}
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        </nav>

        {/* PROFILE FOOTER */}

        {me && (
          <div className="glass mt-auto flex items-center gap-3 rounded-2xl border border-border/70 p-3">
            <Link to="/u/$username" params={{ username: me.username }}>
              <UserAvatar
                profile={me}
                className="h-10 w-10 shrink-0 ring-2 ring-primary/40"
              />
            </Link>

            <div className="min-w-0 flex-1">
              <Link to="/u/$username" params={{ username: me.username }}>
                <p className="truncate text-xs font-semibold text-foreground hover:text-rose-soft">
                  {me.display_name || me.username}
                </p>
              </Link>

              <p className="text-[0.65rem] font-medium text-rose-soft">
                🌹 {me.points_balance} pts
              </p>
            </div>

            <button
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>

      {/* MOBILE TOP HEADER */}

      <header className="glass sticky top-0 z-30 flex items-center justify-between border-x-0 border-t-0 px-4 py-2.5 md:hidden">
        <Link to="/home">
          <Logo />
        </Link>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative rounded-full p-2 text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />

            {unreadNotifs > 0 && (
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-primary shadow-glow ring-2 ring-background" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setFriendsOpen(true)}
            className="relative rounded-full p-2 text-muted-foreground hover:text-foreground"
            aria-label="Friends and Circle"
          >
            <Users className="h-5 w-5" />

            {pendingRequests > 0 && (
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-soft ring-2 ring-background" />
            )}
          </button>

          <Link
            to="/points"
            className="glass flex items-center gap-1 rounded-full border border-primary/30 px-2.5 py-1 text-xs font-semibold text-rose-soft"
          >
            🌹 {me?.points_balance ?? "—"}
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-full p-2 text-muted-foreground hover:text-foreground"
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
          className="fixed inset-0 z-50 flex animate-fade-in bg-black/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="flex h-full w-4/5 max-w-xs flex-col space-y-4 border-r border-border bg-sidebar p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <Logo />

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {me && (
              <div className="glass flex items-center gap-3 rounded-2xl p-3">
                <UserAvatar
                  profile={me}
                  className="h-10 w-10 shrink-0 ring-2 ring-primary/40"
                />

                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">
                    {me.display_name || me.username}
                  </p>

                  <p className="text-[0.65rem] text-rose-soft">
                    🌹 {me.points_balance} VIDA POINTS
                  </p>
                </div>
              </div>
            )}

            <nav className="flex-1 space-y-1 overflow-y-auto">
              <Link
                to="/home"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
              >
                <Home className="h-4 w-4 text-primary" />
                Home
              </Link>

              <Link
                to="/explore"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
              >
                <Compass className="h-4 w-4" />
                Explore
              </Link>

              {/* MESSAGES */}

              <Link
                to="/messages"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
              >
                <MessageSquare className="h-4 w-4 text-primary" />
                Messages
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setNotificationsOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-secondary"
              >
                <span className="flex items-center gap-3">
                  <Bell className="h-4 w-4" />
                  Notifications
                </span>

                {unreadNotifs > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
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
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-secondary"
              >
                <span className="flex items-center gap-3">
                  <Users className="h-4 w-4" />
                  Garden Circle
                </span>

                {pendingRequests > 0 && (
                  <span className="rounded-full bg-rose-soft/20 px-2 py-0.5 text-xs text-rose-soft">
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
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-secondary"
              >
                <Bookmark className="h-4 w-4" />
                Saved Moments
              </button>

              <Link
                to="/reels"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
              >
                <Clapperboard className="h-4 w-4" />
                Reels
              </Link>

              <Link
                to="/points"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4 text-rose-soft" />
                VIDA POINTS
              </Link>

              {me && (
                <Link
                  to="/u/$username"
                  params={{ username: me.username }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
                >
                  <User className="h-4 w-4" />
                  My Profile
                </Link>
              )}

              <Link
                to="/settings/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </nav>

            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-3 rounded-xl p-3 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}

      <main className="pb-24 md:ml-64 md:pb-8">
        <Outlet />
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}

      <nav
        aria-label="Main"
        className="glass fixed inset-x-2 bottom-3 z-30 grid grid-cols-6 rounded-3xl border border-border/80 px-1 py-1.5 shadow-2xl backdrop-blur-xl md:hidden"
      >
        <Link
          to="/home"
          className="flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[0.6rem] text-muted-foreground transition-colors"
          activeProps={{ className: "text-primary font-semibold" }}
        >
          <Home className="h-5 w-5" />
          Home
        </Link>

        <Link
          to="/explore"
          className="flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[0.6rem] text-muted-foreground transition-colors"
          activeProps={{ className: "text-primary font-semibold" }}
        >
          <Compass className="h-5 w-5" />
          Explore
        </Link>

        <Link
          to="/messages"
          className="flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[0.6rem] text-muted-foreground transition-colors"
          activeProps={{ className: "text-primary font-semibold" }}
        >
          <MessageSquare className="h-5 w-5" />
          Messages
        </Link>

        <Link
          to="/create"
          className="flex items-center justify-center"
          aria-label="Create Post"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-rose text-primary-foreground shadow-glow transition-transform active:scale-95">
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </span>
        </Link>

        <Link
          to="/reels"
          className="flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[0.6rem] text-muted-foreground transition-colors"
          activeProps={{ className: "text-primary font-semibold" }}
        >
          <Clapperboard className="h-5 w-5" />
          Reels
        </Link>

        {me ? (
          <Link
            to="/u/$username"
            params={{ username: me.username }}
            className="flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[0.6rem] text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary font-semibold" }}
          >
            <UserAvatar
              profile={me}
              className="h-5 w-5 ring-1 ring-primary/40"
            />
            Profile
          </Link>
        ) : (
          <span className="flex flex-col items-center justify-center gap-0.5 py-1.5 text-[0.6rem] text-muted-foreground">
            <User className="h-5 w-5" />
            Profile
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

      <SavedPostsModal
        open={savedOpen}
        onOpenChange={setSavedOpen}
        me={me ?? null}
      />
    </div>
  );
        }
