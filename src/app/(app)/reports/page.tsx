"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CategoryBars } from "@/components/CategoryBars";
import { MonthInsight } from "@/components/MonthInsight";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionRow } from "@/components/TransactionRow";
import { CountUp } from "@/components/CountUp";
import { Card, PrimaryButton, ScreenTitle } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { listMonthBudgets } from "@/lib/budgets";
import { formatMonthLabel, monthKey, previousMonth } from "@/lib/dates";
import { summarizeMonth, fetchMonthTransactions, previousMonthTotal, spendByCategory, spendByMerchant, sum } from "@/lib/reports";
import type { Budget } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/lib/types";

function ReportsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const month = params.get("month") || monthKey();
  const { household, catalogs, loading } = useHousehold();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [previous, setPrevious] = useState(0);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [busy, setBusy] = useState(true);
  const [earlier, setEarlier] = useState(0);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    const supabase = createClient();
    setBusy(true);
    setError(false);
    try {
      const [txs, prev, twoBack, nextBudgets] = await Promise.all([
        fetchMonthTransactions(supabase, household.id, month),
        previousMonthTotal(supabase, household.id, month),
        previousMonthTotal(supabase, household.id, previousMonth(month)),
        listMonthBudgets(supabase, household.id, month),
      ]);
      setRows(txs);
      setPrevious(prev);
      setEarlier(twoBack);
      setBudgets(nextBudgets);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [household, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = sum(rows);
  const summary = summarizeMonth(rows, month);
  const categories = spendByCategory(rows, catalogs.categories);
  const merchants = spendByMerchant(rows).slice(0, 5);
  const largest = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const householdBudget = budgets.find((b) => !b.category_id);
  const topCategory = categories[0];

  return (
    <div className="space-y-4">
      <ScreenTitle title="Reports" />
      <MonthPicker value={month} onChange={(next) => router.replace(`/reports?month=${next}`)} />

      {loading || busy ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading reports">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      ) : error ? (
        <EmptyState
          title="Something went wrong."
          body="This month's report could not be loaded."
          action={
            <PrimaryButton type="button" onClick={() => void load()}>
              Try again
            </PrimaryButton>
          }
        />
      ) : !rows.length ? (
        <EmptyState
          title="No reports yet"
          body="Add some expenses to see this month's spending."
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
            <p className="mt-1 text-[32px] font-semibold leading-none tracking-tight tabular-nums">
              <CountUp value={total} />
            </p>
            <div className="ledger-rule mt-3" aria-hidden />
            <MonthInsight
              month={month}
              total={total}
              previous={previous}
              count={rows.length}
              top={categories.slice(0, 3).map((row) => ({ name: row.category.name, total: row.total }))}
            />
          </section>

          <Card>
            <h2 className="mb-3 text-[16px] font-semibold">{formatMonthLabel(month)} summary</h2>
            <ul className="space-y-2 text-[15px]">
              <li className="flex justify-between">
                <span className="text-muted">Expenses</span>
                <span>{summary.count}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Daily average</span>
                <span className="tabular-nums">{formatINR(Math.round(summary.dailyAverage))}</span>
              </li>
              {topCategory ? (
                <li className="flex justify-between">
                  <span className="text-muted">Top category</span>
                  <span>{topCategory.category.name}</span>
                </li>
              ) : null}
              {largest[0] ? (
                <li className="flex justify-between gap-3">
                  <span className="text-muted">Largest</span>
                  <span className="min-w-0 truncate text-right">
                    {largest[0].name} · {formatINR(largest[0].amount)}
                  </span>
                </li>
              ) : null}
              <li className="flex justify-between">
                <span className="text-muted">Previous month</span>
                <span className="tabular-nums">{formatINR(previous)}</span>
              </li>
              {householdBudget ? (
                <li className="flex justify-between">
                  <span className="text-muted">Budget used</span>
                  <span>
                    {householdBudget.amount ? Math.round((total / householdBudget.amount) * 100) : 0}% of{" "}
                    {formatINR(householdBudget.amount)}
                  </span>
                </li>
              ) : null}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 text-[16px] font-semibold">Spending trend</h2>
            <TrendBars
              rows={[
                { month: previousMonth(previousMonth(month)), total: earlier },
                { month: previousMonth(month), total: previous },
                { month: month, total },
              ]}
            />
          </Card>

          <Card>
            <h2 className="mb-3 text-[16px] font-semibold">Category breakdown</h2>
            <CategoryBars rows={categories} onSelect={(id) => router.push(`/reports/category/${id}?month=${month}`)} />
          </Card>

          <Card>
            <h2 className="mb-3 text-[16px] font-semibold">Top merchants</h2>
            <ul>
              {merchants.map((row) => (
                <li key={row.merchant.id}>
                  <Link
                    href={`/more/merchants/${row.merchant.id}`}
                    className="press flex items-center justify-between border-b border-line py-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{row.merchant.name}</p>
                      <p className="text-[13px] text-muted">
                        {row.count} purchase{row.count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums">{formatINR(row.total)}</p>
                  </Link>
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

function TrendBars({ rows }: { rows: { month: string; total: number }[] }) {
  const max = Math.max(...rows.map((row) => row.total), 1);
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.month}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-[15px]">{formatMonthLabel(row.month)}</span>
            <span className="tabular-nums text-[15px]">{formatINR(row.total)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
            <div
              className="h-full rounded-full bg-primary motion-reduce:transition-none"
              style={{ width: `${Math.max(6, Math.round((row.total / max) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsInner />
    </Suspense>
  );
}
