"use client";

import { useEffect } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { flushOfflineQueue } from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";
import { saveExpense } from "@/lib/transactions";

export function OfflineFlush() {
  const { household, catalogs, userId } = useHousehold();

  useEffect(() => {
    if (!household || !userId) return;
    const householdId = household.id;
    const uid = userId;

    function flush() {
      if (!navigator.onLine) return;
      void flushOfflineQueue({ userId: uid, householdId }, (item) =>
        saveExpense(createClient(), householdId, uid, catalogs, item),
      );
    }

    function onVisible() {
      if (document.visibilityState === "visible") flush();
    }

    flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [household, catalogs, userId]);

  return null;
}
