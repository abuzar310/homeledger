"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CategoryBars } from "@/components/CategoryBars";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionRow } from "@/components/TransactionRow";
import { Card, PrimaryButton, ScreenTitle } from "@/components/ui";
import { formatMonthLabel, monthKey, previousMonth } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { fetchMonthTransactions, previousMonthTotal, spendByCategory, spendByMerchant, sum } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/lib/types";

function ReportsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const month = params.get("month") || monthKey();
  const { household, catalogs } = useHousehold();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [previous, setPrevious] = useState(0);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!household) return;
    const supabase = createClient();
    setBusy(true);
    Promise.all([
      fetchMonthTransactions(supabase, household.id, month),
      previousMonthTotal(supabase, household.id, month),
    ])
      .then(([txs, prev]) => {
        setRows(txs);
        setPrevious(prev);
      })
      .finally(() => setBusy(false));
  }, [household, month]);

  const total = sum(rows);
  const categories = spendByCategory(rows, catalogs.categories);
  const merchants = spendByMerchant(rows).slice(0, 5);
  const largest = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 5);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Reports" />
      <MonthPicker value={month} onChange={(next) => router.replace(`/reports?month=${next}`)} />

      {busy ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading reports">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      ) : !rows.length ? (
        <EmptyState
          title="No reports yet"
          body="Add some expenses to see your spending reports."
          icon={BarChart3}
          action={
            <Link href="/add">
              <PrimaryButton>Add expense</PrimaryButton>
            </Link>
          }
        />
      ) : (
        <>
          <section>
            <p className="text-[15px] text-muted">This month</p>
            <p className="mt-1 text-[32px] font-semibold leading-none tracking-tight tabular-nums">{formatINR(total)}</p>
            <div className="ledger-rule mt-3" aria-hidden />
          </section>

          <Card>
            <h2 className="mb-3 text-[16px] font-semibold">Month comparison</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[13px] text-muted">{formatMonthLabel(previousMonth(month))}</p>
                <p className="text-lg font-semibold tabular-nums">{formatINR(previous)}</p>
              </div>
              <div>
                <p className="text-[13px] text-muted">{formatMonthLabel(month)}</p>
                <p className="text-lg font-semibold tabular-nums">{formatINR(total)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-[16px] font-semibold">Category breakdown</h2>
            <CategoryBars rows={categories} onSelect={(id) => router.push(`/reports/category/${id}?month=${month}`)} />
          </Card>

          <Card>
            <h2 className="mb-3 text-[16px] font-semibold">Top merchants</h2>
            <ul>
              {merchants.map((row) => (
                <li key={row.merchant.id} className="flex items-center justify-between border-b border-line py-3 last:border-0">
                  <div>
                    <p className="font-medium">{row.merchant.name}</p>
                    <p className="text-[13px] text-muted">
                      {row.count} transaction{row.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatINR(row.total)}</p>
                </li>
              ))}
              {!merchants.length ? <p className="text-muted">No merchant details yet.</p> : null}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-1 text-[16px] font-semibold">Largest expenses</h2>
            {largest.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} showDate />
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsInner />
    </Suspense>
  );
}
