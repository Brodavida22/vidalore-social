import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { myProfileQuery, uploadProfileImage } from "@/services/profiles";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  head: () => ({
    meta: [
      { title: "Edit profile — VIDALORE SOCIAL" },
      { name: "description", content: "Edit your VIDALORE SOCIAL profile." },
      { property: "og:title", content: "Edit profile — VIDALORE SOCIAL" },
      { property: "og:description", content: "Edit your profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditProfile,
});

function EditProfile() {
  const { data: me, isLoading } = useQuery(myProfileQuery());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    location: "",
    is_private: false,
    avatar_url: "",
    cover_url: "",
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);

  useEffect(() => {
    if (me)
      setForm({
        display_name: me.display_name ?? "",
        bio: me.bio ?? "",
        location: me.location ?? "",
        is_private: me.is_private,
        avatar_url: me.avatar_url ?? "",
        cover_url: me.cover_url ?? "",
      });
  }, [me]);

  if (isLoading || !me)
    return (
      <div className="mx-auto max-w-xl p-4">
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );

  async function onFile(kind: "avatar" | "cover", file?: File) {
    if (!file) return;
    setUploading(kind);
    try {
      const url = await uploadProfileImage(me!.id, file, kind);
      setForm((f) => ({ ...f, [`${kind}_url`]: url }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const before = me!.points_balance;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim() || null,
        bio: form.bio.trim() || null,
        location: form.location.trim() || null,
        is_private: form.is_private,
        avatar_url: form.avatar_url || null,
        cover_url: form.cover_url || null,
      })
      .eq("id", me!.id);
    setBusy(false);
    if (error) {
      toast.error("Couldn't save your profile. Please try again.");
      return;
    }
    const fresh = await qc.fetchQuery({ ...myProfileQuery(), staleTime: 0 });
    qc.invalidateQueries({ queryKey: ["profile"] });
    if (fresh && fresh.points_balance > before)
      toast.success(`Profile complete! +${fresh.points_balance - before} VIDA POINTS 🌹`);
    else toast.success("Profile saved");
    navigate({ to: "/u/$username", params: { username: me!.username } });
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-xl space-y-5 px-4 py-6">
      <h1 className="text-4xl font-semibold">Edit profile</h1>
      <p className="text-sm text-muted-foreground">
        Add a photo, display name and bio to earn +50 VIDA POINTS (once).
      </p>

      <div className="relative h-36 overflow-hidden rounded-3xl bg-garden">
        {form.cover_url && (
          <img src={form.cover_url} alt="" className="h-full w-full object-cover" />
        )}
        <label className="glass absolute bottom-3 right-3 flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
          {uploading === "cover" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}{" "}
          Cover
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => onFile("cover", e.target.files?.[0])}
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <UserAvatar
          profile={{ ...me, avatar_url: form.avatar_url || null }}
          className="h-20 w-20 text-2xl"
        />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold">
          {uploading === "avatar" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}{" "}
          Change photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => onFile("avatar", e.target.files?.[0])}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG, WEBP or GIF · up to 5 MB.</p>

      <div>
        <Label>Username</Label>
        <Input value={`@${me.username}`} disabled className="mt-1.5 h-11 rounded-xl" />
      </div>
      <div>
        <Label htmlFor="dn">Display name</Label>
        <Input
          id="dn"
          maxLength={50}
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          className="mt-1.5 h-11 rounded-xl"
        />
      </div>
      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          maxLength={300}
          rows={4}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          className="mt-1.5 rounded-xl"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{form.bio.length}/300</p>
      </div>
      <div>
        <Label htmlFor="loc">Location (optional)</Label>
        <Input
          id="loc"
          maxLength={80}
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="mt-1.5 h-11 rounded-xl"
        />
      </div>
      <div className="glass flex items-center justify-between rounded-2xl p-4">
        <div>
          <Label htmlFor="priv">Private account</Label>
          <p className="text-xs text-muted-foreground">
            Will limit who sees your posts once posting launches.
          </p>
        </div>
        <Switch
          id="priv"
          checked={form.is_private}
          onCheckedChange={(v) => setForm({ ...form, is_private: v })}
        />
      </div>
      <Button
        type="submit"
        variant="rose"
        size="lg"
        className="w-full"
        disabled={busy || !!uploading}
      >
        {busy && <Loader2 className="animate-spin" />} Save profile
      </Button>
    </form>
  );
}
