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
import { MonthTrendChart } from "@/components/MonthTrendChart";
import { ShareBars } from "@/components/ShareBars";
import { SpendPaceChart } from "@/components/SpendPaceChart";
import { Card, PrimaryButton, ScreenTitle } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { listMonthBudgets } from "@/lib/budgets";
import { daysInMonth, formatMonthLabel, monthEnd, monthKey, monthStart, previousMonth, todayISO } from "@/lib/dates";
import {
  cumulativeDaily,
  dailyFromRows,
  daysSoFar,
  fetchDailyTotals,
  fetchMonthTransactions,
  monthTotals,
  monthsBack,
  spendByCategory,
  spendByMerchant,
  spendByPaymentMethod,
  sum,
  summarizeMonth,
} from "@/lib/reports";
import type { Budget } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/lib/types";

const TREND_MONTHS = 6;

function ReportsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const month = params.get("month") || monthKey();
  const { household, catalogs, loading } = useHousehold();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [history, setHistory] = useState<Map<string, number>>(new Map());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    const supabase = createClient();
    setBusy(true);
    setError(false);
    try {
      // Earlier months come from one light query (date + amount); the selected month keeps its full rows.
      const first = monthsBack(month, TREND_MONTHS)[0];
      const [txs, days, nextBudgets] = await Promise.all([
        fetchMonthTransactions(supabase, household.id, month),
        fetchDailyTotals(supabase, household.id, monthStart(first), monthEnd(previousMonth(month))),
        listMonthBudgets(supabase, household.id, month),
      ]);
      setRows(txs);
      setHistory(days);
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
  const paidWith = spendByPaymentMethod(rows);
  const largest = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const householdBudget = budgets.find((b) => !b.category_id);
  const topCategory = categories[0];
  const prevMonth = previousMonth(month);
  const trend = monthTotals(history, monthsBack(month, TREND_MONTHS)).map((row) =>
    row.month === month ? { month, total } : row,
  );
  const previous = trend.find((row) => row.month === prevMonth)?.total ?? 0;
  const paceCurrent = cumulativeDaily(dailyFromRows(rows), month, daysSoFar(month, todayISO()));
  const pacePrevious = cumulativeDaily(history, prevMonth);

  return (
    <div className="space-y-5">
      <ScreenTitle title="Reports" subtitle="This month at a glance" />
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
            <p className="section-label">This month</p>
            <p className="hero-amount mt-2">
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
            <h2 className="mb-3 text-[16px] font-semibold">Month so far</h2>
            <SpendPaceChart
              month={month}
              previousMonth={prevMonth}
              current={paceCurrent}
              previous={pacePrevious}
              daysInMonth={daysInMonth(month)}
              budget={householdBudget?.amount}
            />
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold">{formatMonthLabel(month)} summary</h2>
              <Link href={`/reports/summary?month=${month}`} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary">
                Full summary
              </Link>
            </div>
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
            <h2 className="mb-1 text-[16px] font-semibold">Last {TREND_MONTHS} months</h2>
            <MonthTrendChart
              months={trend}
              selected={month}
              onSelect={(next) => router.replace(`/reports?month=${next}`)}
            />
          </Card>

          <Card>
            <h2 className="mb-3 text-[16px] font-semibold">Category breakdown</h2>
            <CategoryBars rows={categories} onSelect={(id) => router.push(`/reports/category/${id}?month=${month}`)} />
          </Card>

          {paidWith.some((row) => row.id !== "none") ? (
            <Card>
              <h2 className="mb-3 text-[16px] font-semibold">How you paid</h2>
              <ShareBars rows={paidWith} />
            </Card>
          ) : null}

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

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsInner />
    </Suspense>
  );
}
