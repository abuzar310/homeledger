"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CategoryBars } from "@/components/CategoryBars";
import { CountUp } from "@/components/CountUp";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { MonthPicker } from "@/components/MonthPicker";
import { PullRefresh } from "@/components/PullRefresh";
import { TransactionRow } from "@/components/TransactionRow";
import { PrimaryButton } from "@/components/ui";
import { monthKey } from "@/lib/dates";
import { formatINR, percentChange } from "@/lib/money";
import { useSessionOnce } from "@/lib/motion";
import { fetchMonthTransactions, previousMonthTotal, spendByCategory, summarizeMonth } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/lib/types";

function HomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const month = params.get("month") || monthKey();
  const { household, catalogs, loading, refresh } = useHousehold();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [previous, setPrevious] = useState(0);
  const [busy, setBusy] = useState(true);
  const enter = useSessionOnce("hl-home-enter");
  const added = params.get("added");

  const loadMonth = useCallback(async () => {
    if (!household) return;
    const supabase = createClient();
    setBusy(true);
    try {
      const [txs, prev] = await Promise.all([
        fetchMonthTransactions(supabase, household.id, month),
        previousMonthTotal(supabase, household.id, month),
      ]);
      setRows(txs);
      setPrevious(prev);
    } finally {
      setBusy(false);
    }
  }, [household, month]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const summary = summarizeMonth(rows, month);
  const categories = spendByCategory(rows, catalogs.categories).slice(0, 6);
  const change = previous > 0 ? percentChange(summary.total, previous) : null;
  const recent = rows.slice(0, 6);

  return (
    <PullRefresh
      onRefresh={async () => {
        await refresh();
        await loadMonth();
      }}
    >
    <div className="space-y-6">
      <header className={enter ? "enter enter-1" : undefined}>
        <h1 className="sr-only">Home</h1>
        <MonthPicker
          value={month}
          onChange={(next) => router.replace(`/home?month=${next}`)}
          className="text-[22px] font-semibold tracking-tight"
        />
      </header>

      {loading || busy ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading this month">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-8 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
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
          <section className={enter ? "enter enter-2" : undefined}>
            <p className="text-[15px] text-muted">This month</p>
            <p className="mt-1 text-[36px] font-semibold leading-none tracking-tight tabular-nums">
              <CountUp value={summary.total} />
            </p>
            <div className="ledger-rule mt-3" aria-hidden />
            {change != null ? (
              <p className="mt-3 text-[14px] text-muted">
                {change >= 0 ? "Up" : "Down"} {Math.abs(change)}% from last month · {summary.count}{" "}
                {summary.count === 1 ? "spend" : "spends"}
              </p>
            ) : (
              <p className="mt-3 text-[14px] text-muted">
                {summary.count} {summary.count === 1 ? "spend" : "spends"} so far
              </p>
            )}
          </section>

          <dl className={`grid grid-cols-3 gap-3 ${enter ? "enter enter-3" : ""}`}>
            <Mini label="Today" value={formatINR(summary.todayTotal)} />
            <Mini label="Daily average" value={formatINR(Math.round(summary.dailyAverage))} />
            <Mini label="Spends" value={String(summary.count)} />
          </dl>

          <section className={enter ? "enter enter-4" : undefined}>
            <h2 className="mb-3 text-[16px] font-semibold">Spending by category</h2>
            <CategoryBars rows={categories} onSelect={(id) => router.push(`/reports/category/${id}?month=${month}`)} />
          </section>

          <section className={enter ? "enter enter-5" : undefined}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">Recent</h2>
              <Link href="/transactions" className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary">
                View all
              </Link>
            </div>
            {recent.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                showDate
                highlight={tx.id === added}
                onDeleted={(id) => setRows((cur) => cur.filter((row) => row.id !== id))}
              />
            ))}
          </section>
        </>
      )}
    </div>
    </PullRefresh>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold tabular-nums">{value}</dd>
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
