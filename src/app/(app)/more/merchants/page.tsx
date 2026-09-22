"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, ScreenTitle } from "@/components/ui";
import { monthEnd, monthKey, monthStart } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import type { Merchant } from "@/lib/types";

type Row = { merchant: Merchant; total: number; count: number };

export default function MerchantsPage() {
  const { household } = useHousehold();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!household) return;
    const supabase = createClient();
    const month = monthKey();
    Promise.all([
      supabase.from("merchants").select("id, household_id, name, normalized_name").eq("household_id", household.id).order("name"),
      supabase
        .from("transactions")
        .select("merchant_id, amount")
        .eq("household_id", household.id)
        .gte("occurred_on", monthStart(month))
        .lte("occurred_on", monthEnd(month)),
    ]).then(([merchants, txs]) => {
      const stats = new Map<string, { total: number; count: number }>();
      for (const tx of txs.data ?? []) {
        if (!tx.merchant_id) continue;
        const current = stats.get(tx.merchant_id) ?? { total: 0, count: 0 };
        current.total += Number(tx.amount);
        current.count += 1;
        stats.set(tx.merchant_id, current);
      }
      setRows(
        ((merchants.data ?? []) as Merchant[]).map((merchant) => ({
          merchant,
          total: stats.get(merchant.id)?.total ?? 0,
          count: stats.get(merchant.id)?.count ?? 0,
        })),
      );
    });
  }, [household]);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Merchants" />
      <Card>
        {!rows.length ? (
          <p className="text-muted">Merchants appear after you add expenses.</p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.merchant.id} className="flex items-center justify-between border-b border-line py-3 last:border-0">
                <div>
                  <p className="font-medium">{row.merchant.name}</p>
                  <p className="text-[13px] text-muted">
                    {row.count} this month · {formatINR(row.total)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
