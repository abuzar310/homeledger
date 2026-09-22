"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CategoryBars } from "@/components/CategoryBars";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionRow } from "@/components/TransactionRow";
import { Card, PrimaryButton } from "@/components/ui";
import { monthKey } from "@/lib/dates";
import { formatINR, percentChange } from "@/lib/money";
import { fetchMonthTransactions, previousMonthTotal, spendByCategory, summarizeMonth } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/lib/types";

function HomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const month = params.get("month") || monthKey();
  const { household, catalogs, loading } = useHousehold();
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

  const summary = summarizeMonth(rows, month);
  const categories = spendByCategory(rows, catalogs.categories).slice(0, 6);
  const change = percentChange(summary.total, previous);
  const recent = rows.slice(0, 6);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted">HomeLedger</p>
        <MonthPicker value={month} onChange={(next) => router.replace(`/home?month=${next}`)} />
      </header>

      {loading || busy ? (
        <Card>
          <p className="text-muted">Loading this month…</p>
        </Card>
      ) : !rows.length ? (
        <EmptyState
          title="No expenses yet"
          body="Start by adding your first household expense."
          action={
            <Link href="/add">
              <PrimaryButton>Add expense</PrimaryButton>
            </Link>
          }
        />
      ) : (
        <>
          <Card>
            <p className="text-[15px] text-muted">Total spent</p>
            <p className="mt-1 text-[34px] font-semibold leading-none tabular-nums">{formatINR(summary.total)}</p>
            {change != null ? (
              <p className="mt-2 text-[14px] text-muted">
                {change >= 0 ? "↑" : "↓"} {Math.abs(change)}% vs last month
              </p>
            ) : null}
          </Card>

          <div className="grid grid-cols-3 gap-2">
            <Mini label="Today" value={formatINR(summary.todayTotal)} />
            <Mini label="Daily average" value={formatINR(Math.round(summary.dailyAverage))} />
            <Mini label="Transactions" value={String(summary.count)} />
          </div>

          <Card>
            <h2 className="mb-3 text-[16px] font-semibold">Spending by category</h2>
            <CategoryBars rows={categories} onSelect={(id) => router.push(`/reports/category/${id}?month=${month}`)} />
          </Card>

          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">Recent transactions</h2>
              <Link href="/transactions" className="min-h-11 text-[15px] font-semibold text-green">
                View all
              </Link>
            </div>
            {recent.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} showDate />
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 text-[15px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
