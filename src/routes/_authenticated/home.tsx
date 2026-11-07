import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, UserPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { myProfileQuery } from "@/services/profiles";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — VIDALORE SOCIAL" },
      { name: "description", content: "Your VIDALORE SOCIAL home." },
      { property: "og:title", content: "Home — VIDALORE SOCIAL" },
      { property: "og:description", content: "Your VIDALORE SOCIAL home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: me, isLoading } = useQuery(myProfileQuery());
  const complete = me && me.avatar_url && me.display_name && me.bio;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      {isLoading || !me ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : (
        <section className="relative overflow-hidden rounded-3xl bg-garden p-6 shadow-card">
          <div aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/25 blur-3xl" />
          <p className="text-xs uppercase tracking-[0.3em] text-rose-soft">Welcome to the garden</p>
          <h1 className="mt-2 text-4xl font-semibold">Hello, {me.display_name || `@${me.username}`} 🌹</h1>
          <p className="mt-2 text-muted-foreground">You have <strong className="text-foreground">{me.points_balance} VIDA POINTS</strong>.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="rose"><Link to="/points"><Sparkles /> View points</Link></Button>
            {!complete && (
              <Button asChild variant="glass"><Link to="/settings/profile"><UserPen /> Complete profile · +50</Link></Button>
            )}
          </div>
        </section>
      )}
      <section className="glass rounded-3xl p-6 text-center">
        <h2 className="text-2xl font-semibold">Your feed is coming soon</h2>
        <p className="mt-2 text-sm text-muted-foreground">Posts, reactions and comments arrive in Phase 2.</p>
      </section>
    </div>
  );
}
