"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, PrimaryButton, TextInput } from "@/components/ui";
import { GOOGLE_CLIENT_ID, loadGsi } from "@/lib/google";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const googleBtn = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"in" | "up">(() => {
    if (typeof window === "undefined") return "in";
    return new URLSearchParams(window.location.search).get("create") === "1" ? "up" : "in";
  });
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

  useEffect(() => {
    if (!gsiReady || !GOOGLE_CLIENT_ID || !googleBtn.current || !window.google?.accounts?.id) return;
    const host = googleBtn.current;
    const finish = async (credential: string) => {
      setBusy(true);
      setError(null);
      try {
        const { error: idError } = await createClient().auth.signInWithIdToken({
          provider: "google",
          token: credential,
        });
        if (idError) throw idError;
        router.replace("/home");
        router.refresh();
      } catch (err) {
        setBusy(false);
        setError(err instanceof Error ? err.message : "Google sign-in failed.");
      }
    };

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => {
        if (!resp.credential) {
          setError("Google sign-in was cancelled.");
          return;
        }
        void finish(resp.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      context: mode === "up" ? "signup" : "signin",
      itp_support: true,
      use_fedcm_for_prompt: true,
    });
    host.innerHTML = "";
    window.google.accounts.id.renderButton(host, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: Math.min(400, Math.max(280, host.clientWidth || 320)),
      logo_alignment: "left",
    });
  }, [gsiReady, mode, router]);

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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <p className="section-label">HomeLedger</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight [text-wrap:balance]">Your home&apos;s spending</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">Sign in so each family keeps their own expenses.</p>
      <div className="ledger-rule mt-4" aria-hidden />

      <div className="mt-8 min-h-12 w-full" aria-busy={!gsiReady}>
        {GOOGLE_CLIENT_ID ? (
          <div ref={googleBtn} className="flex w-full justify-center overflow-hidden rounded-xl [&>div]:w-full" />
        ) : (
          <p className="rounded-xl border border-line bg-surface px-3 py-3 text-center text-[15px] text-muted">
            Google sign-in is not switched on yet. Use email to create your household.
          </p>
        )}
        {gsiReady || !GOOGLE_CLIENT_ID ? null : (
          <p className="text-center text-[13px] text-muted">Loading Google…</p>
        )}
      </div>
      <p className="mt-2 text-center text-[13px] text-muted">
        Google only shares your email. Prefer a password? Use the form below.
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
