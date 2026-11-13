import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
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
    <main className="flex min-h-dvh items-center justify-center bg-secondary/40 px-5">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm"
      >
        <Logo />
        <h1 className="text-xl font-bold text-foreground">Choose a new password</h1>
        <div>
          <Label htmlFor="np" className="text-xs">
            New password
          </Label>
          <Input
            id="np"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-10 rounded-lg text-xs border-border"
            required
          />
        </div>
        <div>
          <Label htmlFor="cp" className="text-xs">
            Confirm password
          </Label>
          <Input
            id="cp"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 h-10 rounded-lg text-xs border-border"
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-lg bg-[#E91E63] hover:bg-[#C2185B] text-white font-semibold text-xs h-10 shadow-sm"
          disabled={busy}
        >
          {busy && <Loader2 className="animate-spin mr-1.5 h-3.5 w-3.5" />} Update password
        </Button>
      </form>
    </main>
  );
}
