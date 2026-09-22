"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CategoryBars } from "@/components/CategoryBars";
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

  useEffect(() => {
    if (!household) return;
    const supabase = createClient();
    Promise.all([
      fetchMonthTransactions(supabase, household.id, month),
      previousMonthTotal(supabase, household.id, month),
    ]).then(([txs, prev]) => {
      setRows(txs);
      setPrevious(prev);
    });
  }, [household, month]);

  const total = sum(rows);
  const categories = spendByCategory(rows, catalogs.categories);
  const merchants = spendByMerchant(rows).slice(0, 5);
  const largest = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 5);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Reports" />
      <MonthPicker value={month} onChange={(next) => router.replace(`/reports?month=${next}`)} />

      {!rows.length ? (
        <EmptyState
          title="No reports yet"
          body="Add some expenses to see your spending reports."
          action={
            <Link href="/add">
              <PrimaryButton>Add expense</PrimaryButton>
            </Link>
          }
        />
      ) : (
        <>
          <Card>
            <p className="text-muted">Total spent</p>
            <p className="mt-1 text-[32px] font-semibold tabular-nums">{formatINR(total)}</p>
          </Card>

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
