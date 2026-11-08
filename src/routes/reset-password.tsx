import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { friendlyAuthError } from "@/services/profiles";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — VIDALORE SOCIAL" },
      { name: "description", content: "Choose a new password for your VIDALORE SOCIAL account." },
      { property: "og:title", content: "Reset password — VIDALORE SOCIAL" },
      { property: "og:description", content: "Choose a new password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error.message));
    toast.success("Password updated.");
    navigate({ to: "/home", replace: true });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-garden px-5">
      <form
        onSubmit={submit}
        className="glass shadow-card w-full max-w-md space-y-4 rounded-3xl p-8"
      >
        <Logo />
        <h1 className="text-3xl font-semibold">Choose a new password</h1>
        <div>
          <Label htmlFor="np">New password</Label>
          <Input
            id="np"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-11 rounded-xl"
            required
          />
        </div>
        <div>
          <Label htmlFor="cp">Confirm password</Label>
          <Input
            id="cp"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1.5 h-11 rounded-xl"
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="rose" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Update password
        </Button>
      </form>
    </main>
  );
}
