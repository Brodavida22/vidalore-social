import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReportTargetType = "post" | "comment" | "profile";
export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

export interface ContentReport {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  postId?: string | null;
  commentId?: string | null;
  profileId?: string | null;
  reason: string;
  description?: string | null;
  status: ReportStatus;
  adminNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  reporter?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export const moderationKeys = {
  all: ["moderation"] as const,
  reports: (filter?: { status?: ReportStatus | "all"; type?: ReportTargetType | "all" }) =>
    ["moderation", "reports", filter?.status ?? "all", filter?.type ?? "all"] as const,
  isAdmin: () => ["moderation", "is-admin"] as const,
};

export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return false;

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .eq("role", "admin")
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

export async function submitContentReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description?: string | undefined;
  postId?: string | undefined;
  commentId?: string | undefined;
  profileId?: string | undefined;
}): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error("Please sign in to submit a report.");

  const { data, error } = await supabase
    .from("content_reports")
    .insert({
      reporter_id: uid,
      target_type: input.targetType,
      target_id: input.targetId,
      reason: input.reason.trim(),
      description: input.description?.trim() || null,
      post_id: input.postId || (input.targetType === "post" ? input.targetId : null),
      comment_id: input.commentId || (input.targetType === "comment" ? input.targetId : null),
      profile_id: input.profileId || (input.targetType === "profile" ? input.targetId : null),
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to submit report.");
  }

  return data.id;
}

export async function fetchContentReports(filter?: {
  status?: ReportStatus | "all";
  type?: ReportTargetType | "all";
}): Promise<ContentReport[]> {
  let query = supabase
    .from("content_reports")
    .select(
      `
      id,
      reporter_id,
      target_type,
      target_id,
      post_id,
      comment_id,
      profile_id,
      reason,
      description,
      status,
      admin_notes,
      resolved_by,
      resolved_at,
      created_at,
      updated_at,
      reporter:profiles!content_reports_reporter_id_fkey(id, username, display_name, avatar_url)
    `,
    )
    .order("created_at", { ascending: false });

  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }

  if (filter?.type && filter.type !== "all") {
    query = query.eq("target_type", filter.type);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    console.error("Error fetching content reports:", error);
    return [];
  }

  interface ReportRow {
    id: string;
    reporter_id: string;
    target_type: string;
    target_id: string;
    post_id: string | null;
    comment_id: string | null;
    profile_id: string | null;
    reason: string;
    description: string | null;
    status: string;
    admin_notes: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
    reporter?: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  }

  return ((data || []) as unknown as ReportRow[]).map((row) => ({
    id: row.id,
    reporterId: row.reporter_id,
    targetType: row.target_type as ReportTargetType,
    targetId: row.target_id,
    postId: row.post_id,
    commentId: row.comment_id,
    profileId: row.profile_id,
    reason: row.reason,
    description: row.description,
    status: row.status as ReportStatus,
    adminNotes: row.admin_notes,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reporter: row.reporter
      ? {
          id: row.reporter.id,
          username: row.reporter.username,
          displayName: row.reporter.display_name,
          avatarUrl: row.reporter.avatar_url,
        }
      : undefined,
  }));
}

export async function updateReportStatus(input: {
  reportId: string;
  status: ReportStatus;
  adminNotes?: string | undefined;
}): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error("Please sign in as admin.");

  const isResolved = input.status === "resolved" || input.status === "dismissed";

  const { error } = await supabase
    .from("content_reports")
    .update({
      status: input.status,
      admin_notes: input.adminNotes || null,
      resolved_by: isResolved ? uid : null,
      resolved_at: isResolved ? new Date().toISOString() : null,
    })
    .eq("id", input.reportId);

  if (error) {
    throw new Error(error.message || "Failed to update report status.");
  }
}

export const contentReportsQuery = (filter?: {
  status?: ReportStatus | "all";
  type?: ReportTargetType | "all";
}) =>
  queryOptions({
    queryKey: moderationKeys.reports(filter),
    queryFn: () => fetchContentReports(filter),
  });

export const isAdminQuery = () =>
  queryOptions({
    queryKey: moderationKeys.isAdmin(),
    queryFn: isCurrentUserAdmin,
  });
