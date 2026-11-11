import { useState } from "react";
import {
  Users,
  Shield,
  ShieldCheck,
  Crown,
  UserPlus,
  UserMinus,
  LogOut,
  Edit2,
  Check,
  X,
  Loader2,
  Image as ImageIcon,
  MoreVertical,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  type ConversationListItem,
  type Profile,
  type GroupRole,
  getEffectiveRole,
  canManageGroup,
  canPromoteDemote,
  canRemoveGroupMember,
  updateGroupConversation,
  updateGroupMemberRole,
  transferGroupOwnership,
  addGroupMembers,
  removeGroupMember,
  leaveGroupConversation,
  searchProfiles,
} from "@/services/messages";
import { uploadProfileImage } from "@/services/profiles";

export function GroupDetailsSheet({
  open,
  onOpenChange,
  conversation,
  currentUserId,
  onConversationUpdated,
  onLeftGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationListItem;
  currentUserId: string;
  onConversationUpdated: () => void;
  onLeftGroup: () => void;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(conversation.title || "");
  const [savingTitle, setSavingTitle] = useState(false);

  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [searchMemberText, setSearchMemberText] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Successor selection modal for last admin leaving
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [selectedSuccessorId, setSelectedSuccessorId] = useState<string>("");
  const [isLeaving, setIsLeaving] = useState(false);

  // Transfer Ownership confirmation modal
  const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const myRole: GroupRole = getEffectiveRole(currentUserId, conversation, conversation.members);
  const canEditSettings = canManageGroup(myRole);

  const otherMembers = conversation.members.filter((m) => m.user_id !== currentUserId);
  const otherAdmins = otherMembers.filter((m) => {
    const r = getEffectiveRole(m.user_id, conversation, conversation.members);
    return r === "owner" || r === "admin";
  });
  const isLastAdmin = (myRole === "owner" || myRole === "admin") && otherAdmins.length === 0;

  const handleSaveTitle = async () => {
    if (!newTitle.trim()) {
      toast.error("Group title cannot be empty.");
      return;
    }

    setSavingTitle(true);
    try {
      await updateGroupConversation(conversation.id, { title: newTitle.trim() });
      toast.success("Group title updated.");
      setIsEditingTitle(false);
      onConversationUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update group title.");
    } finally {
      setSavingTitle(false);
    }
  };

  const handleUploadGroupImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info("Uploading group image...");
      const imageUrl = await uploadProfileImage(currentUserId, file, "avatar");
      await updateGroupConversation(conversation.id, { image_url: imageUrl });
      toast.success("Group image updated!");
      onConversationUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload group image.");
    }
  };

  const handleSearchMembers = async (term: string) => {
    setSearchMemberText(term);
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const results = await searchProfiles(term, currentUserId);
      const existingIds = new Set(conversation.members.map((m) => m.user_id));
      setSearchResults(results.filter((p) => !existingIds.has(p.id)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleAddMember = async (profile: Profile) => {
    setActionInProgress(profile.id);
    try {
      await addGroupMembers(conversation.id, [profile.id]);
      toast.success(`Added ${profile.display_name || profile.username} to group.`);
      onConversationUpdated();
      setSearchResults((prev) => prev.filter((p) => p.id !== profile.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRoleChange = async (
    targetUserId: string,
    targetName: string,
    newRole: "admin" | "moderator" | "member",
  ) => {
    setActionInProgress(targetUserId);
    try {
      await updateGroupMemberRole(conversation.id, targetUserId, newRole);
      toast.success(`Updated ${targetName}'s role to ${newRole}.`);
      onConversationUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmTransferOwnership = async () => {
    if (!transferTarget) return;
    setIsTransferring(true);
    try {
      await transferGroupOwnership(conversation.id, transferTarget.id);
      toast.success(`Transferred group ownership to ${transferTarget.name}.`);
      setTransferTarget(null);
      onConversationUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to transfer ownership.");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from this group?`)) return;

    setActionInProgress(userId);
    try {
      await removeGroupMember(conversation.id, userId);
      toast.success(`Removed ${name} from group.`);
      onConversationUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleOpenLeaveModal = () => {
    if (otherMembers.length > 0 && isLastAdmin) {
      // Pick first member as default successor
      setSelectedSuccessorId(otherMembers[0]?.user_id || "");
    }
    setLeaveModalOpen(true);
  };

  const handleExecuteLeave = async () => {
    setIsLeaving(true);
    try {
      await leaveGroupConversation(
        conversation.id,
        isLastAdmin && otherMembers.length > 0 ? selectedSuccessorId : undefined,
      );
      toast.success("You left the group.");
      setLeaveModalOpen(false);
      onOpenChange(false);
      onLeftGroup();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to leave group.");
    } finally {
      setIsLeaving(false);
    }
  };

  // Group members into categorized hierarchy
  const membersWithRoles = conversation.members.map((member) => ({
    ...member,
    effectiveRole: getEffectiveRole(member.user_id, conversation, conversation.members),
    name: member.profile?.display_name || member.profile?.username || "Member",
  }));

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-6 flex flex-col bg-card border-border overflow-y-auto"
        >
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle className="flex items-center gap-2 text-foreground font-display text-lg">
              <Users className="h-5 w-5 text-[#E91E63]" />
              Group Information
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Manage group settings, roles, and members.
            </SheetDescription>
          </SheetHeader>

          {/* Group Profile Header */}
          <div className="flex flex-col items-center text-center py-6 border-b border-border space-y-3">
            <div className="relative group">
              {conversation.image_url ? (
                <img
                  src={conversation.image_url}
                  alt={conversation.title || "Group avatar"}
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-[#E91E63]/30"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center text-foreground ring-1 ring-border">
                  <Users size={32} className="text-[#E91E63]" />
                </div>
              )}

              {canEditSettings && (
                <label className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition text-white">
                  <ImageIcon size={20} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadGroupImage}
                  />
                </label>
              )}
            </div>

            {/* Group Title */}
            <div className="w-full px-4">
              {isEditingTitle && canEditSettings ? (
                <div className="flex items-center gap-1.5 justify-center mt-1">
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="h-8 text-xs max-w-xs text-center"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    disabled={savingTitle}
                    className="p-1 rounded-md bg-[#E91E63] text-white hover:bg-[#C2185B]"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(false)}
                    className="p-1 rounded-md bg-secondary text-foreground hover:bg-secondary/80"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <h3 className="font-bold text-foreground text-base truncate">
                    {conversation.title || "Group"}
                  </h3>
                  {canEditSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewTitle(conversation.title || "");
                        setIsEditingTitle(true);
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Edit group name"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {conversation.members.length} member{conversation.members.length === 1 ? "" : "s"}
                </span>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs font-medium text-[#E91E63] capitalize">
                  Your Role: {myRole}
                </span>
              </div>
            </div>
          </div>

          {/* Member Management Section */}
          <div className="flex-1 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Members & Roles
              </h4>
              {canEditSettings && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingMembers(!isAddingMembers)}
                  className="h-7 text-xs rounded-lg gap-1 border-border"
                >
                  <UserPlus size={13} className="text-[#E91E63]" />
                  {isAddingMembers ? "Cancel" : "Add Member"}
                </Button>
              )}
            </div>

            {/* Add Members Drawer Search */}
            {isAddingMembers && canEditSettings && (
              <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-2">
                <Input
                  value={searchMemberText}
                  onChange={(e) => handleSearchMembers(e.target.value)}
                  placeholder="Search user to add..."
                  className="h-8 text-xs bg-card"
                  autoFocus
                />

                {loadingSearch && (
                  <div className="py-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                    <Loader2 size={12} className="animate-spin text-[#E91E63]" />
                    Searching...
                  </div>
                )}

                <div className="max-h-36 overflow-y-auto space-y-1">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-card text-xs transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar profile={user} className="h-6 w-6" />
                        <span className="truncate">{user.display_name || user.username}</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddMember(user)}
                        disabled={Boolean(actionInProgress)}
                        className="h-6 text-[11px] px-2 rounded-md bg-[#E91E63] text-white hover:bg-[#C2185B]"
                      >
                        {actionInProgress === user.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          "Add"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="space-y-1.5">
              {membersWithRoles.map((member) => {
                const isSelf = member.user_id === currentUserId;
                const role = member.effectiveRole;

                const canPromoteToAdmin = canPromoteDemote(myRole, role, "admin");
                const canPromoteToMod = canPromoteDemote(myRole, role, "moderator");
                const canDemoteToMember = canPromoteDemote(myRole, role, "member");
                const canDemoteToMod = myRole === "owner" && role === "admin";
                const canTransfer = myRole === "owner" && !isSelf;
                const canRemove = canRemoveGroupMember(myRole, role, isSelf);
                const hasActions =
                  !isSelf &&
                  (canPromoteToAdmin ||
                    canPromoteToMod ||
                    canDemoteToMember ||
                    canDemoteToMod ||
                    canTransfer ||
                    canRemove);

                return (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-secondary/60 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        profile={
                          member.profile ?? {
                            username: "member",
                            display_name: null,
                            avatar_url: null,
                          }
                        }
                        className="h-8 w-8 ring-1 ring-border"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {member.name}
                          </p>
                          {isSelf && (
                            <span className="text-[10px] text-muted-foreground">(You)</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          @{member.profile?.username || "user"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Role Badge */}
                      {role === "owner" && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-2 py-0.5 gap-1 bg-amber-500/10 text-amber-500 border-amber-500/20"
                        >
                          <Crown size={10} />
                          Owner
                        </Badge>
                      )}
                      {role === "admin" && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-2 py-0.5 gap-1 bg-[#E91E63]/10 text-[#E91E63] border-[#E91E63]/20"
                        >
                          <Shield size={10} />
                          Admin
                        </Badge>
                      )}
                      {role === "moderator" && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-2 py-0.5 gap-1 bg-purple-500/10 text-purple-400 border-purple-500/20"
                        >
                          <ShieldCheck size={10} />
                          Mod
                        </Badge>
                      )}
                      {role === "member" && (
                        <span className="text-[10px] text-muted-foreground px-1.5">Member</span>
                      )}

                      {/* Role Management Dropdown */}
                      {hasActions && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                              title="Manage role"
                            >
                              <MoreVertical size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 text-xs">
                            {canPromoteToAdmin && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(member.user_id, member.name, "admin")
                                }
                                className="gap-2 cursor-pointer text-[#E91E63]"
                              >
                                <Shield size={13} />
                                <span>Promote to Admin</span>
                              </DropdownMenuItem>
                            )}

                            {canPromoteToMod && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(member.user_id, member.name, "moderator")
                                }
                                className="gap-2 cursor-pointer text-purple-400"
                              >
                                <ShieldCheck size={13} />
                                <span>Promote to Moderator</span>
                              </DropdownMenuItem>
                            )}

                            {canDemoteToMod && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(member.user_id, member.name, "moderator")
                                }
                                className="gap-2 cursor-pointer"
                              >
                                <ShieldCheck size={13} />
                                <span>Demote to Moderator</span>
                              </DropdownMenuItem>
                            )}

                            {canDemoteToMember && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(member.user_id, member.name, "member")
                                }
                                className="gap-2 cursor-pointer text-muted-foreground"
                              >
                                <span>Change to Member</span>
                              </DropdownMenuItem>
                            )}

                            {canTransfer && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    setTransferTarget({ id: member.user_id, name: member.name })
                                  }
                                  className="gap-2 cursor-pointer text-amber-500 focus:text-amber-500"
                                >
                                  <ArrowRightLeft size={13} />
                                  <span>Transfer Ownership</span>
                                </DropdownMenuItem>
                              </>
                            )}

                            {canRemove && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleRemoveMember(member.user_id, member.name)}
                                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                                >
                                  <UserMinus size={13} />
                                  <span>Remove from Group</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave Group Button */}
          <div className="border-t border-border pt-4">
            <Button
              variant="destructive"
              onClick={handleOpenLeaveModal}
              className="w-full text-xs rounded-xl h-10 gap-2 font-semibold"
            >
              <LogOut size={15} />
              Leave Group
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation Modal: Leave Group (with Admin Succession if needed) */}
      <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-display text-base">
              <LogOut className="h-5 w-5 text-destructive" />
              Leave Group
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isLastAdmin && otherMembers.length > 0
                ? "You are the only administrator of this group. You must designate a member to become the new administrator before leaving."
                : "Are you sure you want to leave this group? You will no longer receive group messages."}
            </DialogDescription>
          </DialogHeader>

          {isLastAdmin && otherMembers.length > 0 && (
            <div className="space-y-2 py-2">
              <label className="text-xs font-semibold text-foreground">
                Select Successor Administrator:
              </label>
              <select
                value={selectedSuccessorId}
                onChange={(e) => setSelectedSuccessorId(e.target.value)}
                className="w-full h-9 rounded-xl bg-secondary border border-border px-3 text-xs text-foreground focus:outline-none focus:border-[#E91E63]"
              >
                {otherMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.display_name || m.profile?.username || "Member"} (@
                    {m.profile?.username || "user"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeaveModalOpen(false)}
              disabled={isLeaving}
              className="text-xs rounded-lg"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleExecuteLeave}
              disabled={
                isLeaving || (isLastAdmin && otherMembers.length > 0 && !selectedSuccessorId)
              }
              className="text-xs rounded-lg font-semibold gap-1.5"
            >
              {isLeaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
              Confirm & Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal: Transfer Ownership */}
      <Dialog open={Boolean(transferTarget)} onOpenChange={() => setTransferTarget(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-display text-base">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Transfer Group Ownership
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to transfer ownership of{" "}
              <strong>"{conversation.title || "this group"}"</strong> to{" "}
              <strong>{transferTarget?.name}</strong>? You will become an Administrator.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTransferTarget(null)}
              disabled={isTransferring}
              className="text-xs rounded-lg"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmTransferOwnership}
              disabled={isTransferring}
              className="text-xs rounded-lg font-semibold bg-amber-500 hover:bg-amber-600 text-black gap-1.5"
            >
              {isTransferring ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Crown size={13} />
              )}
              Transfer Ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
