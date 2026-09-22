"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureHousehold, loadCatalogs } from "@/lib/household";
import type { Catalogs, Household } from "@/lib/types";

type Ctx = {
  household: Household | null;
  catalogs: Catalogs;
  userId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<Ctx | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [catalogs, setCatalogs] = useState<Catalogs>({ categories: [], subcategories: [], paymentMethods: [] });
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!isSupabaseConfigured()) {
      setError("The household database is not connected yet.");
      setLoading(false);
      return;
    }
    const supabase = createClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const { data, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) throw anonError;
      user = data.user;
    }
    if (!user) {
      setError("Could not open the household.");
      setLoading(false);
      return;
    }
    setUserId(user.id);
    const nextHousehold = await ensureHousehold(supabase);
    const nextCatalogs = await loadCatalogs(supabase);
    setHousehold(nextHousehold);
    setCatalogs(nextCatalogs);
  };

  useEffect(() => {
    refresh()
      .catch((err: Error) => setError(err.message || "Could not load your home"))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({ household, catalogs, userId, loading, error, refresh }),
    [household, catalogs, userId, loading, error],
  );

  if (error && !household) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <h1 className="text-2xl font-semibold">HomeLedger</h1>
        <p className="mt-2 text-muted">{error}</p>
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
