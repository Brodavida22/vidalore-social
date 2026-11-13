import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Eye,
  Flag,
  User,
  MessageSquare,
  FileText,
  AlertTriangle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  contentReportsQuery,
  moderationKeys,
  updateReportStatus,
  isAdminQuery,
  type ContentReport,
  type ReportStatus,
  type ReportTargetType,
} from "@/services/moderation";

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  component: AdminModerationPage,
});

export function AdminModerationPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("pending");
  const [typeFilter, setTypeFilter] = useState<ReportTargetType | "all">("all");
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery(isAdminQuery());

  const {
    data: reports = [],
    isLoading,
    refetch,
  } = useQuery({
    ...contentReportsQuery({ status: statusFilter, type: typeFilter }),
    enabled: !!isAdmin,
  });

  async function handleStatusChange(reportId: string, nextStatus: ReportStatus) {
    setIsUpdating(true);
    try {
      await updateReportStatus({
        reportId,
        status: nextStatus,
        adminNotes: adminNote.trim() || undefined,
      });

      toast.success(`Report marked as ${nextStatus}`);
      setAdminNote("");
      setSelectedReport(null);
      await queryClient.invalidateQueries({ queryKey: moderationKeys.all });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update report status.");
    } finally {
      setIsUpdating(false);
    }
  }

  if (checkingAdmin) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 text-[#E91E63] animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Moderator Access Only</h1>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          The VIDALORE moderation queue is restricted to authorized administrators and community
          stewards. If you believe this is an error, contact platform administration.
        </p>
        <Button asChild className="rounded-lg bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs">
          <Link to="/home">Return to Feed</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-6 py-6 pb-20 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E91E63]/10 text-[#E91E63]">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Community Moderation Queue
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Review reported posts, comments, and member accounts in compliance with VIDALORE
            standards.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button asChild variant="outline" size="sm" className="text-xs h-8 border-border">
            <Link to="/admin">Full Admin Console</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs h-8 border-border"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-xl p-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: "pending", label: "Pending" },
              { id: "reviewing", label: "In Review" },
              { id: "resolved", label: "Resolved" },
              { id: "dismissed", label: "Dismissed" },
              { id: "all", label: "All Reports" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0 ${
                statusFilter === tab.id
                  ? "bg-[#E91E63] text-white shadow-sm"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Target Type Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ReportTargetType | "all")}
            className="rounded-lg bg-secondary border border-border px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#E91E63]"
          >
            <option value="all">All Targets</option>
            <option value="post">Posts</option>
            <option value="comment">Comments</option>
            <option value="profile">Profiles</option>
          </select>
        </div>
      </div>

      {/* Main Reports List */}
      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="h-6 w-6 text-[#E91E63] animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading moderation queue...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-[#22C55E]" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Moderation queue is clean</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No reports currently match the selected {statusFilter} filter.
            </p>
          </div>
        ) : (
          reports.map((report) => {
            const isSelected = selectedReport?.id === report.id;
            const targetIcon = getTargetIcon(report.targetType);

            return (
              <div
                key={report.id}
                className={`rounded-xl border p-4 transition-all bg-card ${
                  isSelected
                    ? "border-[#E91E63] ring-1 ring-[#E91E63]/20 shadow-md"
                    : "border-border hover:border-border/80 hover:bg-secondary/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Left Column: Reporter, Reason & Details */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${getTargetBadge(
                          report.targetType,
                        )}`}
                      >
                        {targetIcon}
                        {report.targetType}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${getStatusBadge(
                          report.status,
                        )}`}
                      >
                        {report.status}
                      </span>

                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTime(report.createdAt)}
                      </span>
                    </div>

                    {/* Reason */}
                    <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-[#E91E63] shrink-0" />
                      <span>{report.reason}</span>
                    </div>

                    {/* Description context */}
                    {report.description && (
                      <p className="text-xs text-muted-foreground bg-secondary/60 rounded-lg p-2.5 leading-relaxed italic border border-border/50">
                        "{report.description}"
                      </p>
                    )}

                    {/* Reporter info */}
                    <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                      <span>Reported by:</span>
                      {report.reporter ? (
                        <Link
                          to="/u/$username"
                          params={{ username: report.reporter.username }}
                          className="font-medium text-foreground hover:text-[#E91E63] flex items-center gap-1.5"
                        >
                          <UserAvatar
                            profile={{
                              username: report.reporter.username,
                              display_name: report.reporter.displayName,
                              avatar_url: report.reporter.avatarUrl,
                            }}
                            className="h-5 w-5 text-[9px]"
                          />
                          <span>@{report.reporter.username}</span>
                        </Link>
                      ) : (
                        <span className="font-mono text-[11px]">
                          user_{report.reporterId.slice(0, 8)}
                        </span>
                      )}
                      <span className="text-muted-foreground/60">·</span>
                      <span className="text-[11px] font-mono text-muted-foreground/80">
                        Target ID: {report.targetId}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0">
                    <Button
                      variant={isSelected ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setSelectedReport(isSelected ? null : report)}
                      className="text-xs h-8 rounded-lg"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      {isSelected ? "Close" : "Inspect & Action"}
                    </Button>
                  </div>
                </div>

                {/* Expanded Action Panel */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3 animate-fade-in bg-secondary/30 -mx-4 -mb-4 p-4 rounded-b-xl">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Moderator Decision Note (optional):
                      </label>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="Add reason for action, guidelines cited, or internal notes..."
                        rows={2}
                        className="w-full rounded-lg bg-card border border-border p-2 text-xs text-foreground focus:ring-1 focus:ring-[#E91E63] focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="text-[11px] text-muted-foreground">
                        Select a resolution state for report #{report.id.slice(0, 8)}:
                      </div>

                      <div className="flex items-center gap-2">
                        {report.status !== "reviewing" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(report.id, "reviewing")}
                            className="text-xs h-8 rounded-lg border-border"
                          >
                            <Clock className="h-3.5 w-3.5 mr-1" />
                            Mark Reviewing
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(report.id, "dismissed")}
                          className="text-xs h-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Dismiss Report
                        </Button>

                        <Button
                          size="sm"
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(report.id, "resolved")}
                          className="text-xs h-8 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white font-semibold shadow-sm"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Resolve Violation
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function getTargetIcon(targetType: ReportTargetType) {
  switch (targetType) {
    case "post":
      return <FileText className="h-3 w-3 mr-1" />;
    case "comment":
      return <MessageSquare className="h-3 w-3 mr-1" />;
    case "profile":
      return <User className="h-3 w-3 mr-1" />;
    case "reel":
      return <Flag className="h-3 w-3 mr-1" />;
    case "meme":
      return <Flag className="h-3 w-3 mr-1" />;
  }
}

function getTargetBadge(targetType: ReportTargetType): string {
  switch (targetType) {
    case "post":
      return "bg-[#E91E63]/10 text-[#E91E63]";
    case "comment":
      return "bg-amber-500/10 text-amber-500";
    case "profile":
      return "bg-blue-500/10 text-blue-500";
    case "reel":
      return "bg-purple-500/10 text-purple-500";
    case "meme":
      return "bg-emerald-500/10 text-emerald-500";
  }
}

function getStatusBadge(status: ReportStatus): string {
  switch (status) {
    case "pending":
      return "bg-destructive/15 text-destructive";
    case "reviewing":
      return "bg-amber-500/15 text-amber-500";
    case "resolved":
      return "bg-emerald-500/15 text-emerald-500";
    case "dismissed":
      return "bg-secondary text-muted-foreground";
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
