"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureHousehold, loadCatalogs, readHomeSnapshot, writeHomeSnapshot } from "@/lib/household";
import { isNetworkError } from "@/lib/offline";
import { loadProfile, type Profile } from "@/lib/profile";
import type { Catalogs, Household } from "@/lib/types";

type Ctx = {
  household: Household | null;
  catalogs: Catalogs;
  user: User | null;
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<Ctx | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [catalogs, setCatalogs] = useState<Catalogs>({ categories: [], subcategories: [], paymentMethods: [] });
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (fresh: boolean) => {
    if (!isSupabaseConfigured()) {
      setHousehold(null);
      setUser(null);
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    // The proxy already verified the user for this page and RLS guards every query, so the
    // stored session is enough here; getUser() would add a blocking auth round trip on every open.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const current = session?.user ?? null;
    // Offline, the last home on this phone lets the app open and queue expenses until it syncs.
    const applySnapshot = (userId: string | null) => {
      const snap = readHomeSnapshot();
      if (!snap || (userId && snap.userId !== userId)) return false;
      setUser(snap.user as User);
      setHousehold(snap.household);
      setCatalogs(snap.catalogs);
      setProfile(snap.profile as Profile | null);
      return true;
    };
    if (!current) {
      // An expired token can't be refreshed offline; the snapshot is cleared on sign-out.
      if (typeof navigator !== "undefined" && !navigator.onLine && applySnapshot(null)) return;
      setUser(null);
      setProfile(null);
      setHousehold(null);
      setLoading(false);
      // Signed out (or the session ended) while inside the app: a full load lets the proxy decide.
      if (typeof window !== "undefined" && navigator.onLine) window.location.replace("/login");
      return;
    }
    setUser(current);
    try {
      const [nextHousehold, nextCatalogs, nextProfile] = await Promise.all([
        ensureHousehold(supabase),
        loadCatalogs(supabase, { fresh }),
        loadProfile(supabase, current),
      ]);
      setHousehold(nextHousehold);
      setCatalogs(nextCatalogs);
      setProfile(nextProfile);
      writeHomeSnapshot({ userId: current.id, user: current, household: nextHousehold, catalogs: nextCatalogs, profile: nextProfile });
    } catch (err) {
      if (isNetworkError(err) && applySnapshot(current.id)) return;
      throw err;
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    load(false)
      .catch(() => setError("Something went wrong."))
      .finally(() => setLoading(false));
  }, [load]);

  const value = useMemo(
    () => ({
      household,
      catalogs,
      user,
      userId: user?.id ?? null,
      profile,
      loading,
      error,
      refresh,
    }),
    [household, catalogs, user, profile, loading, error, refresh],
  );

  if (error && !household) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <p className="section-label">HomeLedger</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Something went wrong.</h1>
        <p className="mt-2 text-[15px] text-muted">This home could not be loaded. Try again in a moment.</p>
        <button
          type="button"
          className="press mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-4 text-[16px] font-semibold text-on-primary"
          onClick={() => {
            setError(null);
            setLoading(true);
            load(true)
              .catch(() => setError("Something went wrong."))
              .finally(() => setLoading(false));
          }}
        >
          Try again
        </button>
      </main>
    );
  }

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
}
