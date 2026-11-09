import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { myProfileQuery } from "@/services/profiles";

export const Route = createFileRoute("/_authenticated/points")({
  head: () => ({
    meta: [
      { title: "VIDA Points — VIDALORE SOCIAL" },
      { name: "description", content: "Your VIDA Points balance and activity history." },
      { property: "og:title", content: "VIDA Points — VIDALORE SOCIAL" },
      { property: "og:description", content: "Your VIDA Points balance and activity history." },
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
      {/* Balance Card */}
      <section className="rounded-2xl border border-border bg-card p-6 text-foreground shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#E91E63]" />
            VIDA Points Balance
          </p>
          <span className="text-[0.7rem] bg-[#E91E63]/10 text-[#E91E63] rounded-md px-2 py-0.5 font-semibold">
            Activity Reward
          </span>
        </div>
        <p className="mt-3 font-display text-5xl font-bold tracking-tight text-[#E91E63]">
          {me ? me.points_balance : "—"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Points are automatically awarded for authentic engagement and community participation.
        </p>
      </section>

      {/* Ways to earn */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Ways to Earn</h2>
        <ul className="mt-3 space-y-2">
          {rewards.data?.map((r) => (
            <li
              key={r.reason}
              className="flex items-center justify-between rounded-lg bg-secondary/50 px-3.5 py-2.5 text-xs border border-border/50"
            >
              <span className="font-medium text-foreground">{r.label}</span>
              <span className="font-semibold text-[#E91E63] flex items-center gap-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" />+{r.amount}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.7rem] text-muted-foreground">
          Achievements and community badges will unlock based on total points accumulated.
        </p>
      </section>

      {/* History */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Activity History</h2>
        {history.isLoading ? (
          <Skeleton className="mt-3 h-20 rounded-lg" />
        ) : history.data?.length ? (
          <ul className="mt-3 divide-y divide-border">
            {history.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <p className="font-medium text-foreground">{labels[t.reason] ?? t.reason}</p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={
                    t.amount >= 0
                      ? "font-semibold text-[#22C55E]"
                      : "font-semibold text-destructive"
                  }
                >
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No points transactions recorded yet.</p>
        )}
      </section>
    </div>
  );
}
