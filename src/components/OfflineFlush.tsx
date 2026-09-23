"use client";

import { useEffect } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { readOfflineQueue, replaceOfflineQueue } from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";
import { saveExpense } from "@/lib/transactions";

export function OfflineFlush() {
  const { household, catalogs, userId } = useHousehold();

  useEffect(() => {
    if (!household || !userId) return;

    async function flush() {
      if (!navigator.onLine) return;
      const queued = readOfflineQueue();
      if (!queued.length) return;
      const left = [];
      for (const item of queued) {
        try {
          await saveExpense(createClient(), household!.id, userId!, catalogs, item);
        } catch {
          left.push(item);
        }
      }
      replaceOfflineQueue(left);
    }

    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [household, catalogs, userId]);

  return null;
}
