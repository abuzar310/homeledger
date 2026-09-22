"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { TransactionRow } from "@/components/TransactionRow";
import { Card } from "@/components/ui";
import { formatMonthLabel, monthKey } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { fetchMonthTransactions, sum } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/lib/types";

function CategoryReportInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const month = params.get("month") || monthKey();
  const { household, catalogs } = useHousehold();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [busy, setBusy] = useState(true);
  const category = catalogs.categories.find((c) => c.id === id);

  useEffect(() => {
    if (!household) return;
    setBusy(true);
    fetchMonthTransactions(createClient(), household.id, month, id)
      .then(setRows)
      .finally(() => setBusy(false));
  }, [household, month, id]);

  const subs = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of rows) {
      const key = tx.subcategory?.name ?? "Other";
      map.set(key, (map.get(key) ?? 0) + tx.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div className="space-y-4">
      <button className="min-h-11 text-[15px] font-semibold text-primary" onClick={() => router.back()}>
        Back
      </button>
      <div>
        <h1 className="text-[22px] font-semibold">{category?.name ?? "Category"}</h1>
        <p className="text-muted">{formatMonthLabel(month)}</p>
        <p className="mt-1 text-[28px] font-semibold tabular-nums">{formatINR(sum(rows))}</p>
      </div>
      {busy && !rows.length ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading category">
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      ) : (
        <>
          <Card>
            <h2 className="mb-3 text-[16px] font-semibold">Subcategories</h2>
            <ul>
              {subs.map(([name, amount]) => (
                <li key={name} className="flex justify-between border-b border-line py-2 last:border-0">
                  <span>{name}</span>
                  <span className="tabular-nums">{formatINR(amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-1 text-[16px] font-semibold">Related transactions</h2>
            {rows.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} showDate />
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

export default function CategoryReportPage() {
  return (
    <Suspense>
      <CategoryReportInner />
    </Suspense>
  );
}
