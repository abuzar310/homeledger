"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, PrimaryButton, ScreenTitle } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import type { Merchant } from "@/lib/types";

type Row = { merchant: Merchant; total: number; count: number };

export default function MerchantsPage() {
  const { household } = useHousehold();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    if (!household) return;
    setBusy(true);
    setError(false);
    try {
      const supabase = createClient();
      const [merchants, txs] = await Promise.all([
        supabase
          .from("merchants")
          .select("id, household_id, name, normalized_name, default_category_id, default_subcategory_id, default_channel")
          .eq("household_id", household.id)
          .order("name"),
        supabase.from("transactions").select("merchant_id, amount").eq("household_id", household.id),
      ]);
      if (merchants.error || txs.error) throw merchants.error ?? txs.error;
      const stats = new Map<string, { total: number; count: number }>();
      for (const tx of txs.data ?? []) {
        if (!tx.merchant_id) continue;
        const current = stats.get(tx.merchant_id) ?? { total: 0, count: 0 };
        current.total += Number(tx.amount);
        current.count += 1;
        stats.set(tx.merchant_id, current);
      }
      setRows(
        ((merchants.data ?? []) as Merchant[])
          .map((merchant) => ({
            merchant,
            total: stats.get(merchant.id)?.total ?? 0,
            count: stats.get(merchant.id)?.count ?? 0,
          }))
          .sort((a, b) => b.total - a.total || a.merchant.name.localeCompare(b.merchant.name)),
      );
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household]);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Merchants" />
      {busy ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading merchants">
          <div className="skeleton h-16 rounded-2xl" />
          <div className="skeleton h-16 rounded-2xl" />
          <div className="skeleton h-16 rounded-2xl" />
        </div>
      ) : error ? (
        <EmptyState
          title="Something went wrong."
          body="Merchants could not be loaded."
          action={<PrimaryButton onClick={() => void load()}>Try again</PrimaryButton>}
        />
      ) : !rows.length ? (
        <EmptyState
          title="No merchants yet"
          body="Merchants appear after you add expenses."
          action={
            <Link href="/add">
              <PrimaryButton>Add expense</PrimaryButton>
            </Link>
          }
        />
      ) : (
        <Card>
          <ul>
            {rows.map((row) => (
              <li key={row.merchant.id}>
                <Link
                  href={`/more/merchants/${row.merchant.id}`}
                  className="press flex items-center justify-between gap-3 border-b border-line py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.merchant.name}</p>
                    <p className="text-[13px] text-muted">
                      {row.count} purchase{row.count === 1 ? "" : "s"} · {formatINR(row.total)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
