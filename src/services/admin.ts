import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminRole, type AdminRole } from "@/services/moderation";
import {
  DEFAULT_GAMES_CATALOG,
  DEFAULT_QUESTIONS,
  type GameDefinition,
  type GameQuestion,
  type GameSlug,
} from "@/services/games";

export type AccountStatus = "active" | "suspended" | "banned";

export interface AdminPermissions {
  role: AdminRole | null;
  canViewOverview: boolean;
  canModerateContent: boolean;
  canResolveReports: boolean;
  canManageUsers: boolean;
  canManageGames: boolean;
  canManageRewards: boolean;
  canManageRoles: boolean;
  canViewAuditLogs: boolean;
}

export function getPermissionsForRole(role: AdminRole | null): AdminPermissions {
  if (!role) {
    return {
      role: null,
      canViewOverview: false,
      canModerateContent: false,
      canResolveReports: false,
      canManageUsers: false,
      canManageGames: false,
      canManageRewards: false,
      canManageRoles: false,
      canViewAuditLogs: false,
    };
  }

  return {
    role,
    canViewOverview: true,
    canModerateContent: true,
    canResolveReports: true,
    canManageUsers: role === "super_admin" || role === "admin",
    canManageGames: role === "super_admin" || role === "admin",
    canManageRewards: role === "super_admin" || role === "admin",
    canManageRoles: role === "super_admin",
    canViewAuditLogs: true,
  };
}

export const adminKeys = {
  all: ["admin"] as const,
  overview: () => ["admin", "overview"] as const,
  users: (search?: string) => ["admin", "users", search ?? ""] as const,
  content: (tab: string) => ["admin", "content", tab] as const,
  games: () => ["admin", "games"] as const,
  questions: (slug?: string) => ["admin", "questions", slug ?? "all"] as const,
  rewards: () => ["admin", "rewards"] as const,
  auditLogs: () => ["admin", "audit-logs"] as const,
};

const dbAny = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>;
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
};

export interface AdminOverviewData {
  totalUsers: number;
  activeUsers7d: number;
  totalPosts: number;
  totalReels: number;
  totalComments: number;
  totalLikes: number;
  totalGameSessions: number;
  pendingReports: number;
  totalReports: number;
  extendedSchemaProvisioned: boolean;
  activitySeries: Array<{
    date: string;
    label: string;
    posts: number;
    reels: number;
    comments: number;
    reports: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: "post" | "reel" | "report" | "signup";
    summary: string;
    actor: string;
    createdAt: string;
  }>;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  pointsBalance: number;
  isPrivate: boolean;
  role: AdminRole | "user";
  accountStatus: AccountStatus;
  isVerified: boolean;
  governanceReason: string | null;
  createdAt: string;
}

export interface AdminPostRecord {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string | null;
  content: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface AdminReelRecord {
  id: string;
  creatorId: string;
  creatorUsername: string;
  caption: string | null;
  audioTitle: string | null;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  createdAt: string;
}

export interface AdminCommentRecord {
  id: string;
  source: "post_comment" | "reel_comment";
  parentId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  createdAt: string;
}

export interface AdminRewardSetting {
  reason: string;
  amount: number;
  label: string;
  isActive: boolean;
  updatedAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  adminId: string | null;
  adminUsername: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

// ============================================================================
// OVERVIEW & ANALYTICS
// ============================================================================

export async function fetchAdminOverview(): Promise<AdminOverviewData> {
  const role = await getMyAdminRole();
  if (!role) throw new Error("Admin or Moderator privileges required.");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    usersCountRes,
    postsCountRes,
    reelsCountRes,
    postCommentsCountRes,
    reelCommentsCountRes,
    postLikesCountRes,
    reelLikesCountRes,
    pendingReportsRes,
    totalReportsRes,
    recentPostsRes,
    recentReelsRes,
    recentCommentsRes,
    recentReportsRes,
    recentProfilesRes,
    gameSessionsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("posts").select("*", { count: "exact", head: true }),
    supabase.from("reels").select("*", { count: "exact", head: true }),
    supabase.from("post_comments").select("*", { count: "exact", head: true }),
    supabase.from("reel_comments").select("*", { count: "exact", head: true }),
    supabase.from("post_likes").select("*", { count: "exact", head: true }),
    supabase.from("reel_likes").select("*", { count: "exact", head: true }),
    supabase
      .from("content_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("content_reports").select("*", { count: "exact", head: true }),
    supabase
      .from("posts")
      .select("id, author_id, content, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("reels")
      .select("id, creator_id, caption, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("post_comments")
      .select("id, created_at")
      .gte("created_at", sevenDaysAgo)
      .limit(250),
    supabase
      .from("content_reports")
      .select("id, reason, target_type, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("profiles")
      .select("id, username, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    dbAny.from("game_sessions").select("*", { count: "exact", head: true }),
  ]);

  const activeAuthorIds = new Set<string>();
  (recentPostsRes.data ?? []).forEach((p) => activeAuthorIds.add(p.author_id));
  (recentReelsRes.data ?? []).forEach((r) => activeAuthorIds.add(r.creator_id));

  // Build 7-day chart buckets
  const dayBuckets = new Map<
    string,
    { date: string; label: string; posts: number; reels: number; comments: number; reports: number }
  >();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: "short" });
    dayBuckets.set(iso, { date: iso, label, posts: 0, reels: 0, comments: 0, reports: 0 });
  }

  for (const p of recentPostsRes.data ?? []) {
    const bucket = dayBuckets.get(p.created_at.slice(0, 10));
    if (bucket) bucket.posts += 1;
  }
  for (const r of recentReelsRes.data ?? []) {
    const bucket = dayBuckets.get(r.created_at.slice(0, 10));
    if (bucket) bucket.reels += 1;
  }
  for (const c of recentCommentsRes.data ?? []) {
    const bucket = dayBuckets.get(c.created_at.slice(0, 10));
    if (bucket) bucket.comments += 1;
  }
  for (const rep of recentReportsRes.data ?? []) {
    const bucket = dayBuckets.get(rep.created_at.slice(0, 10));
    if (bucket) bucket.reports += 1;
  }

  // Resolve usernames for recent activity feed
  const actorIds = [
    ...(recentPostsRes.data ?? []).slice(0, 5).map((p) => p.author_id),
    ...(recentReelsRes.data ?? []).slice(0, 5).map((r) => r.creator_id),
  ];
  const { data: actorProfs } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, username")
        .in("id", [...new Set(actorIds)])
    : { data: [] };
  const actorNameMap = new Map((actorProfs ?? []).map((p) => [p.id, p.username]));

  const recentActivity: AdminOverviewData["recentActivity"] = [
    ...(recentPostsRes.data ?? []).slice(0, 4).map((p) => ({
      id: `post-${p.id}`,
      type: "post" as const,
      summary: p.content ? p.content.slice(0, 64) : "Published a media post",
      actor: `@${actorNameMap.get(p.author_id) ?? "member"}`,
      createdAt: p.created_at,
    })),
    ...(recentReelsRes.data ?? []).slice(0, 3).map((r) => ({
      id: `reel-${r.id}`,
      type: "reel" as const,
      summary: r.caption ? r.caption.slice(0, 64) : "Published a new Reel",
      actor: `@${actorNameMap.get(r.creator_id) ?? "creator"}`,
      createdAt: r.created_at,
    })),
    ...(recentReportsRes.data ?? []).slice(0, 3).map((rep) => ({
      id: `rep-${rep.id}`,
      type: "report" as const,
      summary: `Reported ${rep.target_type}: ${rep.reason}`,
      actor: "Community Report",
      createdAt: rep.created_at,
    })),
    ...(recentProfilesRes.data ?? []).slice(0, 3).map((u) => ({
      id: `user-${u.id}`,
      type: "signup" as const,
      summary: "New member joined VIDALORE SOCIAL",
      actor: `@${u.username}`,
      createdAt: u.created_at,
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);

  return {
    totalUsers: usersCountRes.count ?? 0,
    activeUsers7d: activeAuthorIds.size,
    totalPosts: postsCountRes.count ?? 0,
    totalReels: reelsCountRes.count ?? 0,
    totalComments: (postCommentsCountRes.count ?? 0) + (reelCommentsCountRes.count ?? 0),
    totalLikes: (postLikesCountRes.count ?? 0) + (reelLikesCountRes.count ?? 0),
    totalGameSessions: gameSessionsRes.error ? 0 : (gameSessionsRes.count ?? 0),
    pendingReports: pendingReportsRes.count ?? 0,
    totalReports: totalReportsRes.count ?? 0,
    extendedSchemaProvisioned: !gameSessionsRes.error,
    activitySeries: Array.from(dayBuckets.values()),
    recentActivity,
  };
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export async function fetchAdminUsers(search = ""): Promise<AdminUserRecord[]> {
  const role = await getMyAdminRole();
  if (!role) throw new Error("Admin access required.");

  let query = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, points_balance, is_private, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const trimmed = search.trim();
  if (trimmed) {
    query = query.or(`username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`);
  }

  const { data: profiles, error } = await query;
  if (error) throw new Error(error.message);
  const rows = profiles ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [rolesRes, govRes] = await Promise.all([
    supabase.from("user_roles").select("user_id, role").in("user_id", ids),
    dbAny.from("user_governance").select("*").in("user_id", ids),
  ]);

  const roleMap = new Map<string, AdminRole | "user">();
  for (const r of rolesRes.data ?? []) {
    const val = String(r.role) as AdminRole | "user";
    const existing = roleMap.get(r.user_id);
    if (!existing || val === "super_admin" || (val === "admin" && existing !== "super_admin")) {
      roleMap.set(r.user_id, val);
    }
  }

  const govMap = new Map<
    string,
    { account_status: AccountStatus; is_verified: boolean; reason: string | null }
  >();
  if (!govRes.error && govRes.data) {
    for (const g of govRes.data as unknown as Array<{
      user_id: string;
      account_status: AccountStatus;
      is_verified: boolean;
      reason: string | null;
    }>) {
      govMap.set(g.user_id, g);
    }
  }

  return rows.map((p) => {
    const gov = govMap.get(p.id);
    return {
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      pointsBalance: p.points_balance,
      isPrivate: p.is_private,
      role: roleMap.get(p.id) ?? "user",
      accountStatus: gov?.account_status ?? "active",
      isVerified: gov?.is_verified ?? false,
      governanceReason: gov?.reason ?? null,
      createdAt: p.created_at,
    };
  });
}

export async function adminSetUserGovernance(input: {
  targetUserId: string;
  accountStatus: AccountStatus;
  isVerified: boolean;
  reason?: string;
}): Promise<void> {
  const role = await getMyAdminRole();
  if (role !== "super_admin" && role !== "admin") {
    throw new Error("Admin or Super Admin privileges required.");
  }

  const { error } = await dbAny.rpc("admin_set_user_governance", {
    p_target_user_id: input.targetUserId,
    p_account_status: input.accountStatus,
    p_is_verified: input.isVerified,
    p_reason: input.reason ?? null,
    p_suspended_until: null,
  });

  if (error) {
    throw new Error(
      error.message.includes("Could not find the function")
        ? "User governance RPC not provisioned yet. Apply the SQL schema in Games & Setup."
        : error.message,
    );
  }
}

export async function adminSetUserRole(input: {
  targetUserId: string;
  newRole: AdminRole | "user";
}): Promise<void> {
  const role = await getMyAdminRole();
  if (role !== "super_admin") {
    throw new Error("Only a Super Admin can modify administrative roles.");
  }

  const { error } = await dbAny.rpc("admin_set_user_role", {
    p_target_user_id: input.targetUserId,
    p_new_role: input.newRole,
  });

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================================================
// CONTENT MANAGEMENT
// ============================================================================

export async function fetchAdminContent(): Promise<{
  posts: AdminPostRecord[];
  reels: AdminReelRecord[];
  comments: AdminCommentRecord[];
}> {
  const role = await getMyAdminRole();
  if (!role) throw new Error("Moderation privileges required.");

  const [postsRes, reelsRes, postCommentsRes, reelCommentsRes] = await Promise.all([
    supabase
      .from("posts")
      .select("id, author_id, content, likes_count, comments_count, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("reels")
      .select(
        "id, creator_id, caption, audio_title, likes_count, comments_count, views_count, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("post_comments")
      .select("id, post_id, author_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("reel_comments")
      .select("id, reel_id, author_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const userIds = [
    ...(postsRes.data ?? []).map((p) => p.author_id),
    ...(reelsRes.data ?? []).map((r) => r.creator_id),
    ...(postCommentsRes.data ?? []).map((c) => c.author_id),
    ...(reelCommentsRes.data ?? []).map((c) => c.author_id),
  ];
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", [...new Set(userIds)])
    : { data: [] };

  const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const posts: AdminPostRecord[] = (postsRes.data ?? []).map((p) => ({
    id: p.id,
    authorId: p.author_id,
    authorUsername: profMap.get(p.author_id)?.username ?? "member",
    authorDisplayName: profMap.get(p.author_id)?.display_name ?? null,
    content: p.content,
    likesCount: p.likes_count,
    commentsCount: p.comments_count,
    createdAt: p.created_at,
  }));

  const reels: AdminReelRecord[] = (reelsRes.data ?? []).map((r) => ({
    id: r.id,
    creatorId: r.creator_id,
    creatorUsername: profMap.get(r.creator_id)?.username ?? "creator",
    caption: r.caption,
    audioTitle: r.audio_title,
    likesCount: r.likes_count,
    commentsCount: r.comments_count,
    viewsCount: r.views_count,
    createdAt: r.created_at,
  }));

  const comments: AdminCommentRecord[] = [
    ...(postCommentsRes.data ?? []).map((c) => ({
      id: c.id,
      source: "post_comment" as const,
      parentId: c.post_id,
      authorId: c.author_id,
      authorUsername: profMap.get(c.author_id)?.username ?? "member",
      content: c.content,
      createdAt: c.created_at,
    })),
    ...(reelCommentsRes.data ?? []).map((c) => ({
      id: c.id,
      source: "reel_comment" as const,
      parentId: c.reel_id,
      authorId: c.author_id,
      authorUsername: profMap.get(c.author_id)?.username ?? "member",
      content: c.content,
      createdAt: c.created_at,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { posts, reels, comments };
}

export async function adminDeleteContentItem(input: {
  targetType: "post" | "reel" | "post_comment" | "reel_comment" | "meme";
  targetId: string;
  reason?: string;
}): Promise<void> {
  const role = await getMyAdminRole();
  if (!role) throw new Error("Moderator or Admin privileges required.");

  const { error } = await dbAny.rpc("admin_delete_content", {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: input.reason ?? "Moderation removal",
  });

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================================================
// GAMES, QUESTIONS & REWARDS MANAGEMENT
// ============================================================================

export async function fetchAdminGamesAndQuestions(): Promise<{
  games: GameDefinition[];
  questions: GameQuestion[];
  schemaReady: boolean;
}> {
  const [catRes, qRes] = await Promise.all([
    dbAny.from("games_catalog").select("*").order("title", { ascending: true }),
    dbAny.from("game_questions").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const schemaReady = !catRes.error && !qRes.error;

  const games: GameDefinition[] =
    !catRes.error && catRes.data && catRes.data.length > 0
      ? (
          catRes.data as unknown as Array<{
            slug: GameSlug;
            title: string;
            description: string;
            category: GameDefinition["category"];
            is_enabled: boolean;
            is_featured: boolean;
            xp_reward: number;
            points_reward: number;
            min_players: number;
            max_players: number;
            play_count: number;
          }>
        ).map((r) => ({
          slug: r.slug,
          title: r.title,
          description: r.description,
          category: r.category,
          isEnabled: r.is_enabled,
          isFeatured: r.is_featured,
          isPopular: r.play_count >= 250,
          xpReward: r.xp_reward,
          pointsReward: r.points_reward,
          minPlayers: r.min_players,
          maxPlayers: r.max_players,
          playCount: r.play_count,
          supportsSolo: true,
          supportsMultiplayer: r.max_players > 1,
          estimatedMinutes: "2 min",
        }))
      : DEFAULT_GAMES_CATALOG;

  const questions: GameQuestion[] =
    !qRes.error && qRes.data && qRes.data.length > 0
      ? (
          qRes.data as unknown as Array<{
            id: string;
            game_slug: GameSlug;
            category: string;
            difficulty: "easy" | "medium" | "hard";
            prompt: string;
            options: string[];
            correct_answer: string | null;
            hint: string | null;
            is_active: boolean;
          }>
        ).map((q) => ({
          id: q.id,
          gameSlug: q.game_slug,
          category: q.category,
          difficulty: q.difficulty,
          prompt: q.prompt,
          options: Array.isArray(q.options) ? q.options : [],
          correctAnswer: q.correct_answer ?? "",
          hint: q.hint ?? undefined,
          isActive: q.is_active,
        }))
      : DEFAULT_QUESTIONS;

  return { games, questions, schemaReady };
}

export async function adminSaveGameConfig(input: {
  slug: GameSlug;
  isEnabled: boolean;
  isFeatured: boolean;
  category: string;
  xpReward: number;
  pointsReward: number;
}): Promise<void> {
  const role = await getMyAdminRole();
  if (role !== "super_admin" && role !== "admin") {
    throw new Error("Admin privileges required to configure games.");
  }

  const { error } = await dbAny.rpc("admin_upsert_game_config", {
    p_slug: input.slug,
    p_is_enabled: input.isEnabled,
    p_is_featured: input.isFeatured,
    p_category: input.category,
    p_xp_reward: input.xpReward,
    p_points_reward: input.pointsReward,
  });

  if (error) throw new Error(error.message);
}

export async function adminSaveGameQuestion(input: {
  id?: string | null;
  gameSlug: GameSlug;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: string[];
  correctAnswer: string;
  hint?: string;
  isActive: boolean;
}): Promise<void> {
  const role = await getMyAdminRole();
  if (role !== "super_admin" && role !== "admin") {
    throw new Error("Admin privileges required to manage questions.");
  }

  const { error } = await dbAny.rpc("admin_upsert_game_question", {
    p_id: input.id ?? null,
    p_game_slug: input.gameSlug,
    p_category: input.category,
    p_difficulty: input.difficulty,
    p_prompt: input.prompt,
    p_options: input.options,
    p_correct_answer: input.correctAnswer,
    p_hint: input.hint ?? null,
    p_is_active: input.isActive,
  });

  if (error) throw new Error(error.message);
}

export async function adminDeleteQuestion(questionId: string): Promise<void> {
  const role = await getMyAdminRole();
  if (role !== "super_admin" && role !== "admin") {
    throw new Error("Admin privileges required.");
  }

  const { error } = await dbAny.rpc("admin_delete_game_question", { p_id: questionId });
  if (error) throw new Error(error.message);
}

export async function fetchAdminRewardSettings(): Promise<AdminRewardSetting[]> {
  const { data, error } = await supabase
    .from("reward_settings")
    .select("*")
    .order("reason", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    reason: r.reason,
    amount: r.amount,
    label: r.label,
    isActive: r.is_active,
    updatedAt: r.updated_at,
  }));
}

export async function adminSaveRewardSetting(input: {
  reason: string;
  amount: number;
  label: string;
  isActive: boolean;
}): Promise<void> {
  const role = await getMyAdminRole();
  if (role !== "super_admin" && role !== "admin") {
    throw new Error("Admin privileges required.");
  }

  const { error } = await dbAny.rpc("admin_update_reward_setting", {
    p_reason: input.reason,
    p_amount: input.amount,
    p_label: input.label,
    p_is_active: input.isActive,
  });
  if (error) throw new Error(error.message);
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export async function fetchAdminAuditLogs(): Promise<AdminAuditLogEntry[]> {
  const role = await getMyAdminRole();
  if (!role) throw new Error("Admin access required.");

  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("Audit logs query issue:", error.message);
    return [];
  }

  const rows = data ?? [];
  const adminIds = [...new Set(rows.map((r) => r.admin_id).filter(Boolean) as string[])];
  const { data: profiles } = adminIds.length
    ? await supabase.from("profiles").select("id, username").in("id", adminIds)
    : { data: [] };
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  return rows.map((r) => ({
    id: r.id,
    adminId: r.admin_id,
    adminUsername: r.admin_id ? (nameMap.get(r.admin_id) ?? "admin") : "system",
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    details: (r.details ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }));
}

// ============================================================================
// REACT QUERY OPTIONS
// ============================================================================

export const adminOverviewQuery = () =>
  queryOptions({
    queryKey: adminKeys.overview(),
    queryFn: fetchAdminOverview,
    staleTime: 20_000,
  });

export const adminUsersQuery = (search = "") =>
  queryOptions({
    queryKey: adminKeys.users(search),
    queryFn: () => fetchAdminUsers(search),
  });

export const adminContentQuery = () =>
  queryOptions({
    queryKey: adminKeys.content("all"),
    queryFn: fetchAdminContent,
  });

export const adminGamesQuery = () =>
  queryOptions({
    queryKey: adminKeys.games(),
    queryFn: fetchAdminGamesAndQuestions,
  });

export const adminRewardsQuery = () =>
  queryOptions({
    queryKey: adminKeys.rewards(),
    queryFn: fetchAdminRewardSettings,
  });

export const adminAuditLogsQuery = () =>
  queryOptions({
    queryKey: adminKeys.auditLogs(),
    queryFn: fetchAdminAuditLogs,
  });
