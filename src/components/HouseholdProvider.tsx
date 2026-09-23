"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureHousehold, loadCatalogs } from "@/lib/household";
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
      setError("The household database is not connected yet.");
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const {
      data: { user: current },
    } = await supabase.auth.getUser();
    if (!current) {
      setUser(null);
      setProfile(null);
      setHousehold(null);
      setLoading(false);
      return;
    }
    setUser(current);
    const [nextHousehold, nextCatalogs, nextProfile] = await Promise.all([
      ensureHousehold(supabase),
      loadCatalogs(supabase, { fresh }),
      loadProfile(supabase, current),
    ]);
    setHousehold(nextHousehold);
    setCatalogs(nextCatalogs);
    setProfile(nextProfile);
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
        <h1 className="text-2xl font-semibold">HomeLedger</h1>
        <p className="mt-2 text-muted">Something went wrong.</p>
        <button
          type="button"
          className="press mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 text-[16px] font-semibold text-on-primary"
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
