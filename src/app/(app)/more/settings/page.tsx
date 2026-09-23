"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { saveProfile } from "@/lib/profile";

export default function ProfilePage() {
  const router = useRouter();
  const { household, profile, userId, refresh } = useHousehold();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [homeName, setHomeName] = useState(household?.name ?? "My Home");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (household?.name) setHomeName(household.name);
  }, [profile, household]);

  async function save() {
    if (!userId || !household) return;
    setBusy(true);
    setError(null);
    try {
      await saveProfile(createClient(), userId, {
        full_name: fullName,
        householdId: household.id,
        householdName: homeName,
      });
      await refresh();
      setStatus("Saved");
    } catch {
      setError("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ScreenTitle title="Profile" />
      <Card className="flex items-center gap-4">
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-primary-soft text-lg font-semibold text-primary-deep">
            {(fullName || profile?.email || "Y").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{fullName || profile?.full_name || "Your profile"}</p>
          <p className="truncate text-[15px] text-muted">{profile?.email ?? "Signed in"}</p>
        </div>
      </Card>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Your name">
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Household name">
          <TextInput value={homeName} onChange={(e) => setHomeName(e.target.value)} />
        </Field>
        {error ? <p className="text-[15px] text-danger">{error}</p> : null}
        {status ? <p className="text-[15px] text-accent">{status}</p> : null}
        <PrimaryButton type="submit" disabled={busy}>
          Save profile
        </PrimaryButton>
      </form>

      <button type="button" className="min-h-12 w-full text-[15px] font-semibold text-danger" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
