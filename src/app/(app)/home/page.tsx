"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CategoryBars } from "@/components/CategoryBars";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionRow } from "@/components/TransactionRow";
import { PrimaryButton } from "@/components/ui";
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
  const change = previous > 0 ? percentChange(summary.total, previous) : null;
  const recent = rows.slice(0, 6);

  return (
    <div className="space-y-6">
      <header>
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
          body="Add the first one. Type what you bought and the amount."
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
            <p className="mt-1 text-[36px] font-semibold leading-none tracking-tight tabular-nums">{formatINR(summary.total)}</p>
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

          <dl className="grid grid-cols-3 gap-3">
            <Mini label="Today" value={formatINR(summary.todayTotal)} />
            <Mini label="Daily average" value={formatINR(Math.round(summary.dailyAverage))} />
            <Mini label="Spends" value={String(summary.count)} />
          </dl>

          <section>
            <h2 className="mb-3 text-[16px] font-semibold">Spending by category</h2>
            <CategoryBars rows={categories} onSelect={(id) => router.push(`/reports/category/${id}?month=${month}`)} />
          </section>

          <section>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">Recent</h2>
              <Link href="/transactions" className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary">
                View all
              </Link>
            </div>
            {recent.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} showDate />
            ))}
          </section>
        </>
      )}
    </div>
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
