import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { myProfileQuery } from "@/services/profiles";

export const Route = createFileRoute("/_authenticated/points")({
  head: () => ({
    meta: [
      { title: "VIDA POINTS — VIDALORE SOCIAL" },
      { name: "description", content: "Your VIDA POINTS balance and history." },
      { property: "og:title", content: "VIDA POINTS — VIDALORE SOCIAL" },
      { property: "og:description", content: "Your VIDA POINTS balance and history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PointsPage,
});

function PointsPage() {
  const { data: me } = useQuery(myProfileQuery());
  const history = useQuery({
    queryKey: ["points", "history", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_transactions")
        .select("id, amount, reason, created_at")
        .eq("user_id", me!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  const rewards = useQuery({
    queryKey: ["reward_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_settings")
        .select("reason, amount, label")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });
  const labels = Object.fromEntries((rewards.data ?? []).map((r) => [r.reason, r.label]));

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-rose p-6 text-primary-foreground shadow-glow">
        <p className="text-xs uppercase tracking-[0.3em] opacity-85">VIDA POINTS 🌹</p>
        <p className="mt-2 font-display text-6xl font-bold">{me ? me.points_balance : "—"}</p>
        <p className="mt-1 text-sm opacity-85">
          Earned through real activity — awarded securely by the garden.
        </p>
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="text-2xl font-semibold">Ways to earn</h2>
        <ul className="mt-3 space-y-2">
          {rewards.data?.map((r) => (
            <li
              key={r.reason}
              className="flex justify-between rounded-2xl bg-secondary/60 px-4 py-3 text-sm"
            >
              <span>{r.label}</span>
              <span className="font-semibold text-rose-soft">+{r.amount}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Leaderboards, achievements and games arrive in Phase 6.
        </p>
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="text-2xl font-semibold">History</h2>
        {history.isLoading ? (
          <Skeleton className="mt-3 h-20 rounded-2xl" />
        ) : history.data?.length ? (
          <ul className="mt-3 divide-y divide-border">
            {history.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{labels[t.reason] ?? t.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={
                    t.amount >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"
                  }
                >
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No points activity yet.</p>
        )}
      </section>
    </div>
  );
}
