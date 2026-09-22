"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
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
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUserId(null);
      setHousehold(null);
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

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
}
