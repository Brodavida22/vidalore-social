import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, Home, LogOut, PlusSquare, Clapperboard, User, Sparkles, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { myProfileQuery } from "@/services/profiles";

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

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const linkCls = "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";
  const activeCls = { className: "bg-secondary text-foreground [&_svg]:text-primary" };

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-sidebar p-5 md:flex">
        <Link to="/home"><Logo /></Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={linkCls} activeProps={activeCls}>
              <Icon className="h-5 w-5" /> {label}
            </Link>
          ))}
          {me && (
            <Link to="/u/$username" params={{ username: me.username }} className={linkCls} activeProps={activeCls}>
              <User className="h-5 w-5" /> Profile
            </Link>
          )}
          <Link to="/points" className={linkCls} activeProps={activeCls}>
            <Sparkles className="h-5 w-5" /> VIDA POINTS
          </Link>
          <Link to="/settings/profile" className={linkCls} activeProps={activeCls}>
            <Settings className="h-5 w-5" /> Settings
          </Link>
        </nav>
        {me && (
          <div className="glass flex items-center gap-3 rounded-2xl p-3">
            <UserAvatar profile={me} className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{me.display_name || me.username}</p>
              <p className="text-xs text-rose-soft">🌹 {me.points_balance} pts</p>
            </div>
            <button onClick={signOut} aria-label="Sign out" className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="glass sticky top-0 z-30 flex items-center justify-between border-x-0 border-t-0 px-4 py-3 md:hidden">
        <Link to="/home"><Logo /></Link>
        <div className="flex items-center gap-1">
          <Link to="/points" className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-soft glass">🌹 {me?.points_balance ?? "—"}</Link>
          <button onClick={signOut} aria-label="Sign out" className="rounded-full p-2 text-muted-foreground"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>

      <main className="pb-24 md:ml-64 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav aria-label="Main" className="glass fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-3xl px-2 py-2 md:hidden">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[0.65rem] text-muted-foreground" activeProps={{ className: "text-primary" }}>
            {label === "Create" ? (
              <span className="flex h-9 w-12 items-center justify-center rounded-2xl bg-gradient-rose text-primary-foreground shadow-glow"><Icon className="h-5 w-5" /></span>
            ) : (
              <><Icon className="h-5 w-5" />{label}</>
            )}
          </Link>
        ))}
        {me ? (
          <Link to="/u/$username" params={{ username: me.username }} className="flex flex-col items-center gap-0.5 py-1.5 text-[0.65rem] text-muted-foreground" activeProps={{ className: "text-primary" }}>
            <UserAvatar profile={me} className="h-5 w-5" /> Profile
          </Link>
        ) : (
          <span className="flex flex-col items-center gap-0.5 py-1.5 text-[0.65rem] text-muted-foreground"><User className="h-5 w-5" />Profile</span>
        )}
      </nav>
    </div>
  );
}
