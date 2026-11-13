import { useMemo } from "react";
import {
  Users,
  FileText,
  Clapperboard,
  MessageSquare,
  Heart,
  Gamepad2,
  Flag,
  Activity,
  Radio,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { AdminOverviewData } from "@/services/admin";

export function AdminOverviewSection({
  overview,
  onlineUsersCount,
  onNavigateTab,
}: {
  overview: AdminOverviewData;
  onlineUsersCount: number;
  onNavigateTab: (tab: "overview" | "users" | "content" | "games" | "reports" | "audit") => void;
}) {
  const kpis = useMemo(
    () => [
      {
        label: "Registered Users",
        value: overview.totalUsers,
        sub: `${overview.activeUsers7d} active (7d)`,
        icon: Users,
      },
      {
        label: "Online Now",
        value: onlineUsersCount,
        sub: "Live presence",
        icon: Radio,
        highlight: "text-emerald-500",
      },
      {
        label: "Total Posts",
        value: overview.totalPosts,
        sub: `${overview.totalLikes} total likes`,
        icon: FileText,
      },
      {
        label: "Total Reels",
        value: overview.totalReels,
        sub: `${overview.totalComments} comments`,
        icon: Clapperboard,
      },
      {
        label: "Game Sessions",
        value: overview.totalGameSessions,
        sub: overview.extendedSchemaProvisioned ? "Tracked in DB" : "Needs SQL setup",
        icon: Gamepad2,
      },
      {
        label: "Pending Reports",
        value: overview.pendingReports,
        sub: `${overview.totalReports} total filed`,
        icon: Flag,
        highlight: overview.pendingReports > 0 ? "text-amber-500" : "text-emerald-500",
      },
    ],
    [overview, onlineUsersCount],
  );

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-card p-4 space-y-2 tabular-nums"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{kpi.label}</span>
                <Icon className={`h-4 w-4 shrink-0 ${kpi.highlight ?? "text-[#E91E63]"}`} />
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground truncate">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Activity Chart & Recent Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">
                7-Day Platform Activity
              </h2>
              <p className="text-xs text-muted-foreground">
                Daily posts, reels, comments, and reports across VIDALORE SOCIAL.
              </p>
            </div>
            <Activity className="h-4 w-4 text-[#E91E63]" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={overview.activitySeries}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="postsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E91E63" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#E91E63" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="commentsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111111",
                    borderColor: "#27272a",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="posts"
                  name="Posts"
                  stroke="#E91E63"
                  fill="url(#postsFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="comments"
                  name="Comments"
                  stroke="#38bdf8"
                  fill="url(#commentsFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="reels"
                  name="Reels"
                  stroke="#22c55e"
                  fillOpacity={0}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Recent Activity & Moderation Alert */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-foreground">Recent Activity</h2>
            {overview.pendingReports > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab("reports")}
                className="text-xs font-semibold text-amber-500 hover:underline tabular-nums"
              >
                {overview.pendingReports} pending reports
              </button>
            )}
          </div>

          {overview.recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No recent platform events recorded.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {overview.recentActivity.map((ev) => (
                <div key={ev.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-foreground truncate">{ev.summary}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ev.actor} · <span className="capitalize">{ev.type}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0 tabular-nums">
                    {new Date(ev.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-[#E91E63]" />
              {overview.totalLikes} likes
            </span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
              {overview.totalComments} comments
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
