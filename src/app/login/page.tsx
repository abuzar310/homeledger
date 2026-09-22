"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, PrimaryButton, TextInput } from "@/components/ui";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <h1 className="text-2xl font-semibold">HomeLedger</h1>
        <p className="mt-2 text-muted">The app is not connected to the household database yet.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted">HomeLedger</p>
      <h1 className="mt-2 text-[28px] font-semibold">Welcome back</h1>
      <p className="mt-1 text-muted">Simple spending. A better home.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
          setBusy(false);
          if (authError) {
            setError("That email or password did not work.");
            return;
          }
          router.replace("/home");
        }}
      >
        <Field label="Email">
          <TextInput type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <TextInput type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error ? <p className="text-[15px] text-danger">{error}</p> : null}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </form>
      <p className="mt-5 text-center text-[15px] text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-green">
          Create account
        </Link>
      </p>
    </main>
  );
}
