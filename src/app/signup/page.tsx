"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, PrimaryButton, TextInput } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="text-[28px] font-semibold">Create account</h1>
      <p className="mt-1 text-muted">Then you can start adding household expenses.</p>
      {checkEmail ? (
        <p className="mt-8 text-[16px] leading-7">Please check your email to finish creating the account. Then come back and sign in.</p>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password.length < 6) {
              setError("Please use at least 6 characters.");
              return;
            }
            setBusy(true);
            setError(null);
            const supabase = createClient();
            const { data, error: authError } = await supabase.auth.signUp({ email, password });
            if (authError) {
              setBusy(false);
              setError("Could not create the account. Try another email.");
              return;
            }
            if (!data.session) {
              const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
              if (signInError) {
                setBusy(false);
                setCheckEmail(true);
                return;
              }
            }
            setBusy(false);
            router.replace("/home");
          }}
        >
          <Field label="Email">
            <TextInput type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <TextInput type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error ? <p className="text-[15px] text-danger">{error}</p> : null}
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </PrimaryButton>
        </form>
      )}
      <p className="mt-5 text-center text-[15px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-green">
          Sign in
        </Link>
      </p>
    </main>
  );
}
