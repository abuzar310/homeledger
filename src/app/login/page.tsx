"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, PrimaryButton, TextInput } from "@/components/ui";
import { GOOGLE_CLIENT_ID, loadGsi } from "@/lib/google";
import { createClient } from "@/lib/supabase/client";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.4c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.5 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.5l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.5 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gsiReady, setGsiReady] = useState(false);

  useEffect(() => {
    loadGsi()
      .then(() => setGsiReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load Google sign-in."));
  }, []);

  async function withGoogle() {
    setError(null);
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in is not switched on yet. Use email to create your household.");
      return;
    }
    try {
      if (!window.google?.accounts?.oauth2) await loadGsi();
      const client = window.google?.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email",
        include_granted_scopes: false,
        ux_mode: "popup",
        callback: (resp) => {
          void (async () => {
            if (resp.error || !resp.code) {
              setError("Google sign-in was cancelled.");
              return;
            }
            setBusy(true);
            try {
              const exchanged = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: resp.code }),
              }).then((r) => r.json());
              if (!exchanged.id_token) throw new Error(exchanged.error || "Google sign-in failed.");
              const { error: idError } = await createClient().auth.signInWithIdToken({
                provider: "google",
                token: exchanged.id_token,
              });
              if (idError) throw idError;
              router.replace("/home");
              router.refresh();
            } catch (err) {
              setBusy(false);
              setError(err instanceof Error ? err.message : "Google sign-in failed.");
            }
          })();
        },
      });
      client?.requestCode();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    }
  }

  async function withEmail() {
    setError(null);
    if (!email.trim() || password.length < 6) {
      setError("Enter your email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMode("in");
          setError("Household created. Sign in with the same email.");
          setBusy(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
      router.replace("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="text-[13px] font-medium text-muted">HomeLedger</p>
      <h1 className="mt-1 text-[28px] font-semibold tracking-tight">Your home&apos;s spending</h1>
      <p className="mt-2 text-[15px] text-muted">Sign in so each family keeps their own expenses.</p>

      <button
        type="button"
        onClick={() => void withGoogle()}
        disabled={busy || !gsiReady}
        className="press mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface text-[16px] font-semibold disabled:opacity-45"
      >
        <GoogleMark />
        {gsiReady ? "Continue with Google" : "Loading Google…"}
      </button>
      <p className="mt-2 text-center text-[13px] text-muted">
        We only ask Google for your email. If a warning appears, tap Advanced, then continue — or use email below.
      </p>

      <p className="my-6 text-center text-[13px] text-muted">or email</p>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void withEmail();
        }}
      >
        {mode === "up" ? (
          <Field label="Your name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
        ) : null}
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Password">
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} />
        </Field>
        {error ? (
          <p className="text-[15px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <PrimaryButton type="submit" disabled={busy}>
          {mode === "up" ? "Create household" : "Sign in"}
        </PrimaryButton>
      </form>

      <button
        type="button"
        className="mt-5 min-h-11 text-[15px] font-semibold text-primary"
        onClick={() => {
          setMode((m) => (m === "in" ? "up" : "in"));
          setError(null);
        }}
      >
        {mode === "in" ? "New here? Create a household" : "Already have one? Sign in"}
      </button>
    </main>
  );
}
