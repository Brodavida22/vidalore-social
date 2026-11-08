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
import { getStoredNotifications, getStoredRelationships } from "@/services/social";
import { NotificationsModal } from "@/components/social/NotificationsModal";
import { FriendsModal } from "@/components/social/FriendsModal";
import { SavedPostsModal } from "@/components/social/SavedPostsModal";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
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
    return () => window.removeEventListener("vidalore:social-updated", handleUpdate);
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
    className: "bg-secondary text-foreground [&_svg]:text-primary font-semibold shadow-sm",
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border/80 bg-sidebar p-5 md:flex z-30">
        <Link to="/home" className="hover:opacity-95 transition-opacity">
          <Logo />
        </Link>

        {/* Quick New Post CTA */}
        <div className="mt-6">
          <Button
            asChild
            variant="rose"
            className="w-full rounded-2xl shadow-glow py-5 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Link to="/create">
              <Plus className="h-4 w-4" /> Plant a Moment 🌹
            </Link>
          </Button>
        </div>

        <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto pr-1" aria-label="Main">
          <Link to="/home" className={linkCls} activeProps={activeCls}>
            <Home className="h-5 w-5" /> Home
          </Link>
          <Link to="/explore" className={linkCls} activeProps={activeCls}>
            <Compass className="h-5 w-5" /> Explore
          </Link>

          {/* Notifications Modal trigger */}
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="flex items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground text-left"
          >
            <span className="flex items-center gap-3">
              <Bell className="h-5 w-5" /> Notifications
            </span>
            {unreadNotifs > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold text-primary-foreground shadow-glow">
                {unreadNotifs}
              </span>
            )}
          </button>

          {/* Friends Modal trigger */}
          <button
            type="button"
            onClick={() => setFriendsOpen(true)}
            className="flex items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground text-left"
          >
            <span className="flex items-center gap-3">
              <Users className="h-5 w-5" /> Garden Circle
            </span>
            {pendingRequests > 0 && (
              <span className="rounded-full bg-rose-soft/20 text-rose-soft px-2 py-0.5 text-[0.7rem] font-bold">
                {pendingRequests} new
              </span>
            )}
          </button>

          {/* Saved Posts trigger */}
          <button
            type="button"
            onClick={() => setSavedOpen(true)}
            className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground text-left"
          >
            <Bookmark className="h-5 w-5" /> Saved Moments
          </button>

          <Link to="/reels" className={linkCls} activeProps={activeCls}>
            <Clapperboard className="h-5 w-5" /> Reels
          </Link>

          <Link to="/points" className={linkCls} activeProps={activeCls}>
            <Sparkles className="h-5 w-5 text-rose-soft" /> VIDA POINTS
          </Link>

          {me && (
            <Link
              to="/u/$username"
              params={{ username: me.username }}
              className={linkCls}
              activeProps={activeCls}
            >
              <User className="h-5 w-5" /> Profile
            </Link>
          )}

          <Link to="/settings/profile" className={linkCls} activeProps={activeCls}>
            <Settings className="h-5 w-5" /> Settings
          </Link>
        </nav>

        {/* Profile Card Footer */}
        {me && (
          <div className="glass flex items-center gap-3 rounded-2xl p-3 border border-border/70 mt-auto">
            <Link to="/u/$username" params={{ username: me.username }}>
              <UserAvatar profile={me} className="h-10 w-10 ring-2 ring-primary/40 shrink-0" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to="/u/$username" params={{ username: me.username }}>
                <p className="truncate text-xs font-semibold text-foreground hover:text-rose-soft">
                  {me.display_name || me.username}
                </p>
              </Link>
              <p className="text-[0.65rem] text-rose-soft font-medium">
                🌹 {me.points_balance} pts
              </p>
            </div>
            <button
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile top header */}
      <header className="glass sticky top-0 z-30 flex items-center justify-between border-x-0 border-t-0 px-4 py-2.5 md:hidden">
        <Link to="/home">
          <Logo />
        </Link>
        <div className="flex items-center gap-1.5">
          {/* Notifications bell */}
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative rounded-full p-2 text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifs > 0 && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-primary shadow-glow ring-2 ring-background" />
            )}
          </button>

          {/* Friends button */}
          <button
            type="button"
            onClick={() => setFriendsOpen(true)}
            className="relative rounded-full p-2 text-muted-foreground hover:text-foreground"
            aria-label="Friends & Circle"
          >
            <Users className="h-5 w-5" />
            {pendingRequests > 0 && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-rose-soft ring-2 ring-background" />
            )}
          </button>

          {/* VIDA Points chip */}
          <Link
            to="/points"
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-rose-soft glass flex items-center gap-1 border border-primary/30"
          >
            🌹 {me?.points_balance ?? "—"}
          </Link>

          {/* Menu button for slide-out sheet */}
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

      {/* Mobile slide-out menu drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex bg-black/80 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-4/5 max-w-xs h-full bg-sidebar border-r border-border p-5 flex flex-col space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {me && (
              <div className="glass rounded-2xl p-3 flex items-center gap-3">
                <UserAvatar profile={me} className="h-10 w-10 ring-2 ring-primary/40 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{me.display_name || me.username}</p>
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
                <Home className="h-4 w-4 text-primary" /> Home
              </Link>
              <Link
                to="/explore"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
              >
                <Compass className="h-4 w-4" /> Explore
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setNotificationsOpen(true);
                }}
                className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary text-left"
              >
                <span className="flex items-center gap-3">
                  <Bell className="h-4 w-4" /> Notifications
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
                className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary text-left"
              >
                <span className="flex items-center gap-3">
                  <Users className="h-4 w-4" /> Garden Circle
                </span>
                {pendingRequests > 0 && (
                  <span className="rounded-full bg-rose-soft/20 text-rose-soft px-2 py-0.5 text-xs">
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
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary text-left"
              >
                <Bookmark className="h-4 w-4" /> Saved Moments
              </button>
              <Link
                to="/reels"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
              >
                <Clapperboard className="h-4 w-4" /> Reels
              </Link>
              <Link
                to="/points"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4 text-rose-soft" /> VIDA POINTS
              </Link>
              {me && (
                <Link
                  to="/u/$username"
                  params={{ username: me.username }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
                >
                  <User className="h-4 w-4" /> My Profile
                </Link>
              )}
              <Link
                to="/settings/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
              >
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </nav>

            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-3 rounded-xl p-3 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="pb-24 md:ml-64 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav — Android optimized */}
      <nav
        aria-label="Main"
        className="glass fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-3xl px-1.5 py-1.5 md:hidden border border-border/80 shadow-2xl backdrop-blur-xl"
      >
        <Link
          to="/home"
          className="flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[0.65rem] text-muted-foreground transition-colors"
          activeProps={{ className: "text-primary font-semibold" }}
        >
          <Home className="h-5 w-5" />
          Home
        </Link>

        <Link
          to="/explore"
          className="flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[0.65rem] text-muted-foreground transition-colors"
          activeProps={{ className: "text-primary font-semibold" }}
        >
          <Compass className="h-5 w-5" />
          Explore
        </Link>

        {/* Prominent Glowing Create Button */}
        <Link to="/create" className="flex items-center justify-center" aria-label="Create Post">
          <span className="flex h-11 w-12 items-center justify-center rounded-2xl bg-gradient-rose text-primary-foreground shadow-glow active:scale-95 transition-transform">
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </span>
        </Link>

        <Link
          to="/reels"
          className="flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[0.65rem] text-muted-foreground transition-colors"
          activeProps={{ className: "text-primary font-semibold" }}
        >
          <Clapperboard className="h-5 w-5" />
          Reels
        </Link>

        {me ? (
          <Link
            to="/u/$username"
            params={{ username: me.username }}
            className="flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[0.65rem] text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary font-semibold" }}
          >
            <UserAvatar profile={me} className="h-5 w-5 ring-1 ring-primary/40" />
            Profile
          </Link>
        ) : (
          <span className="flex flex-col items-center justify-center gap-0.5 py-1.5 text-[0.65rem] text-muted-foreground">
            <User className="h-5 w-5" />
            Profile
          </span>
        )}
      </nav>

      {/* Social Modals */}
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
