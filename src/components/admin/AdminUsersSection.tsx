import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, BadgeCheck, ShieldBan, RotateCcw, Shield } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  adminUsersQuery,
  adminSetUserGovernance,
  adminSetUserRole,
  adminKeys,
  type AdminPermissions,
  type AdminUserRecord,
  type AccountStatus,
} from "@/services/admin";
import type { AdminRole } from "@/services/moderation";

export function AdminUsersSection({
  myUserId,
  permissions,
}: {
  myUserId: string;
  permissions: AdminPermissions;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery(adminUsersQuery(search));

  const filtered = users.filter((u) => statusFilter === "all" || u.accountStatus === statusFilter);

  async function handleToggleVerify(user: AdminUserRecord) {
    setBusyId(user.id);
    try {
      await adminSetUserGovernance({
        targetUserId: user.id,
        accountStatus: user.accountStatus,
        isVerified: !user.isVerified,
        reason: !user.isVerified ? "Verified by administration" : "Verification removed",
      });
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      toast.success(
        !user.isVerified ? `@${user.username} verified` : `@${user.username} unverified`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update verification.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(user: AdminUserRecord, nextStatus: AccountStatus) {
    setBusyId(user.id);
    try {
      await adminSetUserGovernance({
        targetUserId: user.id,
        accountStatus: nextStatus,
        isVerified: user.isVerified,
        reason: nextStatus === "active" ? "Account restored" : `Account marked ${nextStatus}`,
      });
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      toast.success(`@${user.username} status updated to ${nextStatus}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update account status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRoleChange(user: AdminUserRecord, nextRole: AdminRole | "user") {
    setBusyId(user.id);
    try {
      await adminSetUserRole({ targetUserId: user.id, newRole: nextRole });
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      toast.success(`@${user.username} role set to ${nextRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update role.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or display name..."
            className="h-9 pl-8 text-xs bg-secondary"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          {(["all", "active", "suspended", "banned"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-2.5 py-1 text-xs capitalize whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? "bg-card text-[#E91E63] font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Member</th>
                <th className="px-4 py-2.5 text-left font-semibold">Role</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold">Points</th>
                <th className="px-4 py-2.5 text-right font-semibold">Joined</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading registered members...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No matching users found.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => {
                  const isSelf = user.id === myUserId;
                  const isBusy = busyId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            profile={{
                              username: user.username,
                              display_name: user.displayName,
                              avatar_url: user.avatarUrl,
                            }}
                            className="h-7 w-7 text-[10px] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground flex items-center gap-1 truncate">
                              {user.displayName || `@${user.username}`}
                              {user.isVerified && (
                                <BadgeCheck className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              @{user.username}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {permissions.canManageRoles && !isSelf ? (
                          <select
                            aria-label={`Role for ${user.username}`}
                            value={user.role}
                            disabled={isBusy}
                            onChange={(e) =>
                              void handleRoleChange(user, e.target.value as AdminRole | "user")
                            }
                            className="h-7 rounded-md border border-border bg-secondary px-2 text-[11px] font-medium"
                          >
                            <option value="user">user</option>
                            <option value="moderator">moderator</option>
                            <option value="admin">admin</option>
                            <option value="super_admin">super_admin</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase text-foreground">
                            {user.role !== "user" && <Shield className="h-3 w-3 text-[#E91E63]" />}
                            {user.role}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] font-semibold capitalize ${
                            user.accountStatus === "active"
                              ? "text-emerald-500"
                              : user.accountStatus === "suspended"
                                ? "text-amber-500"
                                : "text-destructive"
                          }`}
                        >
                          {user.accountStatus}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {user.pointsBalance}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {permissions.canManageUsers ? (
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => void handleToggleVerify(user)}
                              className="h-7 text-[11px] px-2 whitespace-nowrap shrink-0"
                            >
                              {user.isVerified ? "Unverify" : "Verify"}
                            </Button>

                            {!isSelf && user.accountStatus === "active" && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() => void handleStatusChange(user, "suspended")}
                                  className="h-7 text-[11px] px-2 text-amber-500 border-amber-500/30 whitespace-nowrap shrink-0"
                                >
                                  Suspend
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  disabled={isBusy}
                                  onClick={() => void handleStatusChange(user, "banned")}
                                  className="h-7 text-[11px] px-2 whitespace-nowrap shrink-0"
                                >
                                  <ShieldBan className="h-3 w-3 mr-1" />
                                  Ban
                                </Button>
                              </>
                            )}

                            {!isSelf && user.accountStatus !== "active" && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => void handleStatusChange(user, "active")}
                                className="h-7 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap shrink-0"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Restore
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
