import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { checkUsernameAvailable, friendlyAuthError } from "@/services/profiles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VIDALORE SOCIAL — Connect, Share & Discover" },
      {
        name: "description",
        content: "Join VIDALORE SOCIAL. A modern platform for creators, thinkers, and communities.",
      },
      { property: "og:title", content: "VIDALORE SOCIAL" },
      { property: "og:description", content: "Connect, Share & Discover." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

type Mode = "signin" | "signup" | "forgot" | "check-email";

function LandingPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [sentTo, setSentTo] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/home", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-secondary/40 px-5 py-12">
      <div className="relative z-10 grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
        <section className="text-center lg:text-left space-y-6">
          <Logo size="lg" className="justify-center lg:justify-start" />
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl font-display">
              Connect. Share. <br />
              <span className="text-primary">Discover communities.</span>
            </h1>
            <p className="mx-auto max-w-md text-sm sm:text-base text-muted-foreground lg:mx-0 leading-relaxed">
              Join a modern network built for meaningful discussions, authentic content, and
              real-time collaboration.
            </p>
          </div>

          <div className="hidden lg:grid grid-cols-3 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-lg font-bold text-foreground">Real-time</p>
              <p className="text-xs text-muted-foreground">Instant messaging & feeds</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Verified</p>
              <p className="text-xs text-muted-foreground">Direct community access</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Points</p>
              <p className="text-xs text-muted-foreground">Earn for contribution</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          {mode !== "check-email" && mode !== "forgot" && (
            <div role="tablist" className="mb-6 grid grid-cols-2 rounded-lg bg-secondary p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-md py-2 text-xs font-semibold transition-all ${
                    mode === m
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          )}
          <div key={mode}>
            {mode === "signin" && <SignInForm onForgot={() => setMode("forgot")} />}
            {mode === "signup" && (
              <SignUpForm
                onDone={(email) => {
                  setSentTo(email);
                  setMode("check-email");
                }}
              />
            )}
            {mode === "forgot" && <ForgotForm onBack={() => setMode("signin")} />}
            {mode === "check-email" && (
              <div className="text-center py-4">
                <h2 className="text-xl font-bold text-foreground">Check your inbox</h2>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  We sent a confirmation link to{" "}
                  <strong className="text-foreground">{sentTo}</strong>. Open it to activate your
                  account — your 100 points bonus is waiting.
                </p>
                <Button
                  variant="outline"
                  className="mt-6 text-xs rounded-lg"
                  onClick={() => setMode("signin")}
                >
                  Back to sign in
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(friendlyAuthError(error.message));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        id="si-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
      />
      <Field
        id="si-pass"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
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
        {busy && <Loader2 className="animate-spin mr-1.5 h-3.5 w-3.5" />} Sign in
      </Button>
      <button
        type="button"
        onClick={onForgot}
        className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        Forgot your password?
      </button>
    </form>
  );
}

function SignUpForm({ onDone }: { onDone: (email: string) => void }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">(
    "idle",
  );

  const normalized = username.trim().toLowerCase();

  useEffect(() => {
    if (!normalized) return setStatus("idle");
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) return setStatus("invalid");
    setStatus("checking");
    const t = setTimeout(async () => {
      try {
        setStatus((await checkUsernameAvailable(normalized)) ? "available" : "taken");
      } catch {
        setStatus("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [normalized]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (status !== "available") return setError("Please choose an available username.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    if (!(await checkUsernameAvailable(normalized))) {
      setBusy(false);
      setStatus("taken");
      return setError("That username was just taken. Try another.");
    }
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username: normalized, display_name: displayName.trim() },
      },
    });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error.message));
    toast.success("Account created! Check your email to continue.");
    onDone(email.trim());
  }

  const hint = {
    idle: "3–20 letters, numbers or underscores.",
    checking: "Checking…",
    available: "Available!",
    taken: "Already taken.",
    invalid: "Use 3–20 lowercase letters, numbers or _.",
  }[status];

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <Label htmlFor="su-user" className="text-xs">
          Username
        </Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            @
          </span>
          <Input
            id="su-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 rounded-lg pl-7 pr-9 text-xs border-border"
            autoComplete="username"
            required
            maxLength={20}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {status === "checking" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            {status === "available" && <Check className="h-3.5 w-3.5 text-[#22C55E]" />}
            {(status === "taken" || status === "invalid") && (
              <X className="h-3.5 w-3.5 text-destructive" />
            )}
          </span>
        </div>
        <p
          aria-live="polite"
          className={`mt-1 text-[0.7rem] ${
            status === "available"
              ? "text-[#22C55E]"
              : status === "taken" || status === "invalid"
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
        >
          {hint}
        </p>
      </div>
      <Field
        id="su-name"
        label="Display name"
        value={displayName}
        onChange={setDisplayName}
        autoComplete="name"
        required={false}
      />
      <Field
        id="su-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
      />
      <Field
        id="su-pass"
        label="Password (8+ characters)"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />
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
        {busy && <Loader2 className="animate-spin mr-1.5 h-3.5 w-3.5" />} Create account · +100 pts
      </Button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) setError(friendlyAuthError(error.message));
    else setSent(true);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Reset password</h2>
      {sent ? (
        <p className="text-xs text-muted-foreground">
          If an account exists for {email}, a reset link is on its way.
        </p>
      ) : (
        <>
          <Field
            id="fp-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
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
            {busy && <Loader2 className="animate-spin mr-1.5 h-3.5 w-3.5" />} Send reset link
          </Button>
        </>
      )}
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        Back to sign in
      </button>
    </form>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={props.id} className="text-xs">
        {props.label}
      </Label>
      <Input
        id={props.id}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        required={props.required ?? true}
        className="mt-1 h-10 rounded-lg text-xs border-border"
      />
    </div>
  );
}
