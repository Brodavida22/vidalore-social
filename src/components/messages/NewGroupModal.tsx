import { useState, useEffect } from "react";
import { Users, Search, Loader2, X, Check, Image as ImageIcon } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  searchProfiles,
  createGroupConversation,
  type Profile,
  type Conversation,
} from "@/services/messages";
import { uploadProfileImage } from "@/services/profiles";

export function NewGroupModal({
  open,
  onOpenChange,
  currentUserId,
  onGroupCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onGroupCreated: (conversation: Conversation) => void;
}) {
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setSearch("");
      setResults([]);
      setSelectedMembers([]);
      setImageFile(null);
      setImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let active = true;
    setLoadingProfiles(true);

    const timer = setTimeout(
      () => {
        searchProfiles(search, currentUserId)
          .then((data) => {
            if (active) {
              setResults(data);
              setLoadingProfiles(false);
            }
          })
          .catch((err) => {
            console.error("Failed to load profiles:", err);
            if (active) setLoadingProfiles(false);
          });
      },
      search.trim() ? 250 : 0,
    );

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, search, currentUserId]);

  const toggleSelectMember = (profile: Profile) => {
    setSelectedMembers((prev) => {
      const exists = prev.some((p) => p.id === profile.id);
      if (exists) {
        return prev.filter((p) => p.id !== profile.id);
      } else {
        return [...prev, profile];
      }
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error("Please provide a group name.");
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error("Please select at least one member to join the group.");
      return;
    }

    setCreatingGroup(true);

    try {
      let uploadedImageUrl: string | undefined;

      // Upload group image if provided
      if (imageFile) {
        try {
          uploadedImageUrl = await uploadProfileImage(currentUserId, imageFile, "avatar");
        } catch (uploadErr) {
          console.warn("Group image upload fallback:", uploadErr);
        }
      }

      const memberIds = selectedMembers.map((m) => m.id);
      const group = await createGroupConversation(cleanTitle, memberIds, uploadedImageUrl);

      toast.success(`Group "${cleanTitle}" created successfully! 🌹`);
      onGroupCreated(group);
      onOpenChange(false);
    } catch (err) {
      console.error("Error creating group:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card p-5 max-h-[85vh] sm:max-w-md flex flex-col rounded-2xl shadow-xl">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="font-display text-xl flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-[#E91E63]" />
            New Group Chat
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create a collaborative space with friends and colleagues.
          </DialogDescription>
        </DialogHeader>

        {/* Group Name & Image */}
        <div className="flex items-center gap-3 pt-2">
          <label className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-border bg-secondary hover:bg-secondary/80 transition overflow-hidden">
            {imagePreview ? (
              <img src={imagePreview} alt="Group preview" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Group name (e.g., Creative Crew)..."
            className="h-10 rounded-xl bg-secondary/60 text-xs border-border focus-visible:ring-[#E91E63]"
            maxLength={60}
          />
        </div>

        {/* Selected Members Chips */}
        {selectedMembers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 py-2 max-h-20 overflow-y-auto">
            {selectedMembers.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#E91E63]/10 text-[#E91E63] border border-[#E91E63]/20 pl-2 pr-1.5 py-0.5 text-xs font-medium"
              >
                <span>{member.display_name || member.username}</span>
                <button
                  type="button"
                  onClick={() => toggleSelectMember(member)}
                  className="rounded-full p-0.5 hover:bg-[#E91E63]/20 transition"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Member Search */}
        <div className="relative pt-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members to add..."
            className="h-9 rounded-xl bg-secondary/60 pl-10 pr-9 text-xs border-border focus-visible:ring-[#E91E63]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Search Results / Member Selection */}
        <div className="flex-1 overflow-y-auto space-y-1 py-2 pr-1 min-h-[160px] max-h-[220px]">
          {loadingProfiles ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-[#E91E63]" />
              <p className="text-xs">Finding members...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No members found.</div>
          ) : (
            results.map((profile) => {
              const isSelected = selectedMembers.some((m) => m.id === profile.id);

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => toggleSelectMember(profile)}
                  className={`w-full flex items-center justify-between gap-3 p-2 rounded-xl transition text-left border ${
                    isSelected
                      ? "bg-[#E91E63]/10 border-[#E91E63]/30"
                      : "hover:bg-secondary border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar profile={profile} className="h-8 w-8 shrink-0 ring-1 ring-border" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {profile.display_name || profile.username}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        @{profile.username}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`h-5 w-5 rounded-md flex items-center justify-center border transition ${
                      isSelected
                        ? "bg-[#E91E63] border-[#E91E63] text-white"
                        : "border-border bg-card"
                    }`}
                  >
                    {isSelected && <Check size={13} strokeWidth={3} />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {selectedMembers.length} member{selectedMembers.length === 1 ? "" : "s"} selected
          </p>

          <Button
            type="button"
            onClick={handleCreate}
            disabled={!title.trim() || selectedMembers.length === 0 || creatingGroup}
            className="rounded-xl bg-[#E91E63] hover:bg-[#C2185B] text-white font-semibold text-xs h-9 shadow-sm"
          >
            {creatingGroup ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Group"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
