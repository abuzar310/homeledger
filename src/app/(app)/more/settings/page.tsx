"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Moon, Smartphone, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { clearCatalogCache } from "@/lib/household";
import { clearOfflineQueueFor, flushOfflineQueue, queuedFor } from "@/lib/offline";
import { saveProfile } from "@/lib/profile";
import { clearMonthCache } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import { readTheme, setTheme, subscribeTheme, type ThemeChoice } from "@/lib/theme";
import { saveExpense } from "@/lib/transactions";

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Smartphone },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function AppearanceCard() {
  // Server render and hydration use "system"; the saved choice shows right after.
  const theme = useSyncExternalStore(subscribeTheme, () => readTheme(), () => "system" as const);
  return (
    <Card>
      <fieldset>
        <legend className="section-label">Appearance</legend>
        <p className="mt-0.5 text-[13px] text-muted">System follows your phone&apos;s light or dark setting. Saved on this phone only.</p>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-bg p-1 ring-1 ring-line">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={`press flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                theme === value ? "bg-primary font-semibold text-on-primary" : "font-medium text-muted"
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { household, catalogs, profile, userId, refresh } = useHousehold();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [homeName, setHomeName] = useState(household?.name ?? "My Home");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discardQueued, setDiscardQueued] = useState(false);
  const [signOutNote, setSignOutNote] = useState<string | null>(null);

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
    if (userId && household && !discardQueued) {
      const owner = { userId, householdId: household.id };
      if (navigator.onLine) {
        await flushOfflineQueue(owner, (item) => saveExpense(createClient(), household.id, userId, catalogs, item));
      }
      const left = queuedFor(owner).length;
      if (left) {
        setDiscardQueued(true);
        setSignOutNote(
          `${left} expense${left === 1 ? " is" : "s are"} only on this phone and not synced yet. Go online to sync, or tap Sign out again to delete ${left === 1 ? "it" : "them"}.`,
        );
        return;
      }
    }
    await createClient().auth.signOut();
    // Shared phones: nothing from this account should be left for the next person.
    if (userId) clearOfflineQueueFor(userId);
    clearCatalogCache();
    clearMonthCache();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <ScreenTitle title="Profile" subtitle="Name and household" />
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

      <AppearanceCard />

      {signOutNote ? <p className="text-[15px] text-danger">{signOutNote}</p> : null}
      <button type="button" className="min-h-12 w-full text-[15px] font-semibold text-danger" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
