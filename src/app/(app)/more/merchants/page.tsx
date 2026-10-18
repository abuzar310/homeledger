"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, PrimaryButton, ScreenTitle } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { likelyDuplicates } from "@/lib/merchants";
import { allPages } from "@/lib/paging";
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
        // Every expense with a merchant, past the API's 1,000-row cap, so old totals stay complete.
        allPages((from, to) =>
          supabase
            .from("transactions")
            .select("merchant_id, amount")
            .eq("household_id", household.id)
            .not("merchant_id", "is", null)
            .order("id")
            .range(from, to),
        ) as Promise<{ merchant_id: string | null; amount: unknown }[]>,
      ]);
      if (merchants.error) throw merchants.error;
      const stats = new Map<string, { total: number; count: number }>();
      for (const tx of txs) {
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

  const duplicates = likelyDuplicates(rows.map((row) => row.merchant));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household]);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Merchants" />
      <p className="text-[15px] text-muted">Tap a store to rename it, set its category, or merge duplicates.</p>
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
            <Link
              href="/add"
              className="press inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-4 text-[16px] font-semibold text-on-primary"
            >
              Add expense
            </Link>
          }
        />
      ) : (
        <>
        {duplicates.length ? (
          <Card>
            <h2 className="text-[16px] font-semibold">Possible duplicates</h2>
            <p className="mt-0.5 text-[13px] text-muted">Open one and use Merge into… to keep their expenses together.</p>
            <ul className="mt-2">
              {duplicates.slice(0, 5).map(([a, b]) => (
                <li key={`${a.id}:${b.id}`}>
                  <Link
                    href={`/more/merchants/${a.id}`}
                    className="press flex min-h-12 items-center justify-between gap-3 border-b border-line text-[15px] last:border-0"
                  >
                    <span className="min-w-0 truncate">
                      {a.name} <span className="text-muted">and</span> {b.name}
                    </span>
                    <span className="shrink-0 font-semibold text-primary">Review</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
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
        </>
      )}
    </div>
  );
}
