import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  FileText,
  Gamepad2,
  Flag,
  History,
  ShieldAlert,
  RotateCcw,
  Loader2,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { subscribeOnlineUsersCount } from "@/lib/onlinePresence";
import { Button } from "@/components/ui/button";
import { myProfileQuery } from "@/services/profiles";
import {
  adminRoleQuery,
  contentReportsQuery,
  updateReportStatus,
  moderationKeys,
  type ReportStatus,
  type ReportTargetType,
} from "@/services/moderation";
import {
  adminOverviewQuery,
  adminAuditLogsQuery,
  adminKeys,
  getPermissionsForRole,
  adminDeleteContentItem,
} from "@/services/admin";
import { AdminOverviewSection } from "@/components/admin/AdminOverviewSection";
import { AdminUsersSection } from "@/components/admin/AdminUsersSection";
import { AdminContentSection } from "@/components/admin/AdminContentSection";
import { AdminGamesSection } from "@/components/admin/AdminGamesSection";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — VIDALORE SOCIAL" },
      {
        name: "description",
        content: "VIDALORE SOCIAL administration, analytics, games and moderation console.",
      },
    ],
  }),
  component: AdminDashboardPage,
});

type AdminTab = "overview" | "users" | "content" | "games" | "reports" | "audit";

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(myProfileQuery());
  const { data: adminRole, isLoading: checkingRole } = useQuery(adminRoleQuery());
  const permissions = getPermissionsForRole(adminRole ?? null);

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [onlineUsersCount, setOnlineUsersCount] = useState(1);

  // Reports filter state
  const [reportStatus, setReportStatus] = useState<ReportStatus | "all">("pending");
  const [reportType, setReportType] = useState<ReportTargetType | "all">("all");
  const [adminNote, setAdminNote] = useState("");
  const [busyReportId, setBusyReportId] = useState<string | null>(null);

  const {
    data: overview,
    isLoading: loadingOverview,
    refetch: refetchOverview,
  } = useQuery({
    ...adminOverviewQuery(),
    enabled: permissions.canViewOverview,
  });

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    ...contentReportsQuery({ status: reportStatus, type: reportType }),
    enabled: permissions.canResolveReports && activeTab === "reports",
  });

  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    ...adminAuditLogsQuery(),
    enabled: permissions.canViewAuditLogs && activeTab === "audit",
  });

  // Subscribe to global online presence count from shared AppShell tracker
  useEffect(() => {
    if (!permissions.canViewOverview) return;
    return subscribeOnlineUsersCount(setOnlineUsersCount);
  }, [permissions.canViewOverview]);

  async function handleRefreshAll() {
    await queryClient.invalidateQueries({ queryKey: adminKeys.all });
    await queryClient.invalidateQueries({ queryKey: moderationKeys.all });
    await refetchOverview();
    toast.success("Dashboard metrics refreshed");
  }

  async function handleResolveReport(
    reportId: string,
    status: ReportStatus,
    deleteTarget?: { type: "post" | "reel" | "post_comment"; id: string },
  ) {
    setBusyReportId(reportId);
    try {
      if (deleteTarget) {
        await adminDeleteContentItem({
          targetType: deleteTarget.type,
          targetId: deleteTarget.id,
          reason: adminNote.trim() || "Removed via moderation queue",
        });
      }
      await updateReportStatus({
        reportId,
        status,
        adminNotes: adminNote.trim() || undefined,
      });
      setAdminNote("");
      await queryClient.invalidateQueries({ queryKey: moderationKeys.all });
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      toast.success(`Report marked ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process report.");
    } finally {
      setBusyReportId(null);
    }
  }

  if (checkingRole) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 text-[#E91E63] animate-spin" />
      </div>
    );
  }

  if (!adminRole || !permissions.canViewOverview) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Administrative Access Restricted
        </h1>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          Access to the VIDALORE Admin Console is enforced by backend database roles (Super Admin,
          Admin, or Moderator).
        </p>
        <Button asChild className="bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs">
          <Link to="/home">Return to Feed</Link>
        </Button>
      </div>
    );
  }

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "users", label: "Users & Roles", icon: Users },
    { id: "content", label: "Content", icon: FileText },
    { id: "games", label: "Games & Rewards", icon: Gamepad2 },
    { id: "reports", label: "Reports Queue", icon: Flag },
    { id: "audit", label: "Audit Logs", icon: History },
  ];

  const activeTitle = navItems.find((n) => n.id === activeTab)?.label ?? "Overview";

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-5 pb-24">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Workspace Sidebar (240px desktop) */}
        <aside className="lg:w-60 shrink-0 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#E91E63]" />
              <span className="font-display text-sm font-bold text-foreground">Admin Console</span>
            </div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#E91E63]">
              Role: {adminRole.replace("_", " ")}
            </p>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-[#E91E63] text-white font-semibold"
                      : "bg-card lg:bg-transparent border lg:border-0 border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {item.id === "reports" && (overview?.pendingReports ?? 0) > 0 && (
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isActive ? "bg-white/20 text-white" : "bg-amber-500/15 text-amber-500"
                      }`}
                    >
                      {overview?.pendingReports}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Admin Viewport */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Top Breadcrumb Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                VIDALORE Admin / {activeTitle}
              </p>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                {activeTitle}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleRefreshAll()}
                className="h-8 text-xs whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Refresh
              </Button>
            </div>
          </div>

          {activeTab === "overview" &&
            (loadingOverview || !overview ? (
              <div className="py-16 text-center text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-[#E91E63] mx-auto mb-2" />
                Loading real-time platform analytics...
              </div>
            ) : (
              <AdminOverviewSection
                overview={overview}
                onlineUsersCount={onlineUsersCount}
                onNavigateTab={setActiveTab}
              />
            ))}

          {activeTab === "users" && (
            <AdminUsersSection myUserId={me?.id ?? ""} permissions={permissions} />
          )}

          {activeTab === "content" && <AdminContentSection permissions={permissions} />}

          {activeTab === "games" && <AdminGamesSection permissions={permissions} />}

          {activeTab === "reports" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1 rounded-lg bg-secondary p-1 overflow-x-auto">
                  {(["pending", "reviewing", "resolved", "dismissed", "all"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setReportStatus(st)}
                      className={`rounded-md px-3 py-1 text-xs capitalize whitespace-nowrap shrink-0 ${
                        reportStatus === st
                          ? "bg-card text-[#E91E63] font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportTargetType | "all")}
                  className="h-8 rounded-lg border border-border bg-secondary px-2.5 text-xs"
                >
                  <option value="all">All Targets</option>
                  <option value="post">Posts</option>
                  <option value="reel">Reels</option>
                  <option value="comment">Comments</option>
                  <option value="profile">Profiles</option>
                  <option value="meme">Memes</option>
                </select>
              </div>

              {loadingReports ? (
                <p className="py-12 text-center text-xs text-muted-foreground">
                  Loading moderation reports...
                </p>
              ) : reports.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold">No {reportStatus} reports</p>
                  <p className="text-xs text-muted-foreground">Moderation queue is up to date.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="rounded-xl border border-border bg-card p-4 space-y-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="uppercase font-bold text-[#E91E63]">
                            {rep.targetType}
                          </span>
                          <span>·</span>
                          <span className="uppercase font-semibold">{rep.status}</span>
                          <span>·</span>
                          <span className="text-muted-foreground">
                            {new Date(rep.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          Reported by @{rep.reporter?.username ?? "member"}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-foreground">{rep.reason}</p>
                      {rep.description && (
                        <p className="rounded-lg bg-secondary/50 p-2.5 text-muted-foreground italic">
                          &ldquo;{rep.description}&rdquo;
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                        <input
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="Resolution note (optional)..."
                          className="h-8 flex-1 min-w-[200px] rounded-lg border border-border bg-secondary px-2.5 text-xs"
                        />

                        <div className="flex items-center gap-1.5">
                          {rep.status !== "reviewing" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busyReportId === rep.id}
                              onClick={() => void handleResolveReport(rep.id, "reviewing")}
                              className="h-8 text-xs"
                            >
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              Review
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busyReportId === rep.id}
                            onClick={() => void handleResolveReport(rep.id, "dismissed")}
                            className="h-8 text-xs text-muted-foreground"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Dismiss
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyReportId === rep.id}
                            onClick={() =>
                              void handleResolveReport(
                                rep.id,
                                "resolved",
                                rep.targetType === "post" || rep.targetType === "reel"
                                  ? { type: rep.targetType, id: rep.targetId }
                                  : undefined,
                              )
                            }
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "audit" && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="font-display text-sm font-bold">Moderation & Admin Audit Log</h2>
              </div>

              {loadingAudit ? (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  Loading audit logs...
                </p>
              ) : auditLogs.length === 0 ? (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  No administrative audit log entries recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-border text-xs tabular-nums">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">
                          <span className="font-mono text-[#E91E63]">{log.action}</span> by @
                          {log.adminUsername}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {log.targetType ?? "system"} {log.targetId ? `#${log.targetId}` : ""} ·{" "}
                          {JSON.stringify(log.details)}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
