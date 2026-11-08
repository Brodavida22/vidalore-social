import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { RosePetals } from "@/components/brand/RosePetals";
import { checkUsernameAvailable, friendlyAuthError } from "@/services/profiles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Rose Garden — VIDALORE SOCIAL 🌹" },
      { name: "description", content: "Join VIDALORE SOCIAL. Connect. Express. Play. Belong." },
      { property: "og:title", content: "The Rose Garden — VIDALORE SOCIAL" },
      { property: "og:description", content: "Connect. Express. Play. Belong." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoseGarden,
});

type Mode = "signin" | "signup" | "forgot" | "check-email";

function RoseGarden() {
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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-garden px-5 py-10">
      <div
        aria-hidden="true"
        className="animate-glow pointer-events-none absolute left-1/2 top-[18%] h-72 w-72 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl"
      />
      <RosePetals />
      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        <section className="animate-rise text-center lg:text-left">
          <Logo size="lg" className="justify-center lg:justify-start" />
          <p className="mt-6 font-display text-sm uppercase tracking-[0.4em] text-rose-soft">
            The Rose Garden 🌹
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            Connect. Express. <span className="text-gradient-rose">Play. Belong.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground lg:mx-0">
            Share moments, watch reels, and grow your circle in a garden made for you.
          </p>
        </section>

        <section
          className="animate-rise glass shadow-card mx-auto w-full max-w-md rounded-3xl p-6 sm:p-8"
          style={{ animationDelay: "0.15s" }}
        >
          {mode !== "check-email" && mode !== "forgot" && (
            <div role="tablist" className="mb-6 grid grid-cols-2 rounded-full bg-background/60 p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-full py-2 text-sm font-semibold transition-all ${mode === m ? "bg-gradient-rose text-primary-foreground shadow-glow" : "text-muted-foreground"}`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          )}
          <div key={mode} className="animate-rise">
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
              <div className="text-center">
                <h2 className="text-3xl font-semibold">Check your inbox</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  We sent a confirmation link to{" "}
                  <strong className="text-foreground">{sentTo}</strong>. Open it to bloom into the
                  garden — your 100 VIDA POINTS are waiting.
                </p>
                <Button variant="glass" className="mt-6" onClick={() => setMode("signin")}>
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
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="rose" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Sign in
      </Button>
      <button
        type="button"
        onClick={onForgot}
        className="w-full text-center text-sm text-rose-soft hover:underline"
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
    // Re-check right before sign-up to avoid races.
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
    toast.success("Account created! Confirm your email to continue.");
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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="su-user">Username</Label>
        <div className="relative mt-1.5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
          <Input
            id="su-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-11 rounded-xl pl-7 pr-9"
            autoComplete="username"
            required
            maxLength={20}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {status === "checking" && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {status === "available" && <Check className="h-4 w-4 text-success" />}
            {(status === "taken" || status === "invalid") && (
              <X className="h-4 w-4 text-destructive" />
            )}
          </span>
        </div>
        <p
          aria-live="polite"
          className={`mt-1 text-xs ${status === "available" ? "text-success" : status === "taken" || status === "invalid" ? "text-destructive" : "text-muted-foreground"}`}
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
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="rose" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Create account · +100 🌹
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
      <h2 className="text-3xl font-semibold">Reset password</h2>
      {sent ? (
        <p className="text-sm text-muted-foreground">
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
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" variant="rose" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Send reset link
          </Button>
        </>
      )}
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-sm text-rose-soft hover:underline"
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
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        required={props.required ?? true}
        className="mt-1.5 h-11 rounded-xl"
      />
    </div>
  );
}
