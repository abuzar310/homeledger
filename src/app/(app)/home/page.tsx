"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BudgetProgress } from "@/components/BudgetProgress";
import { CategoryBars } from "@/components/CategoryBars";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { OverviewCard } from "@/components/OverviewCard";
import { PullRefresh } from "@/components/PullRefresh";
import { QuickAddGrid } from "@/components/QuickAddGrid";
import { TransactionRow } from "@/components/TransactionRow";
import { WeekChart } from "@/components/WeekChart";
import { Card, PrimaryButton, SectionLabel } from "@/components/ui";
import { listMonthBudgets } from "@/lib/budgets";
import { monthKey, shiftISO, startOfWeek, todayISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { useSessionOnce } from "@/lib/motion";
import { notifyIfAllowed, readNotifyPrefs } from "@/lib/notify";
import {
  fetchMonthTransactions,
  fetchRangeTransactions,
  previousMonthTotal,
  spendByCategory,
  spendThisWeek,
  summarizeMonth,
} from "@/lib/reports";
import { listRecurring, markRecurringCreated, type RecurringExpense } from "@/lib/recurring";
import { createClient } from "@/lib/supabase/client";
import { saveExpense } from "@/lib/transactions";
import type { Budget, Transaction } from "@/lib/types";

function HomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const month = params.get("month") || monthKey();
  const { household, catalogs, loading, refresh, userId } = useHousehold();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [weekRows, setWeekRows] = useState<Transaction[]>([]);
  const [lastMonthTotal, setLastMonthTotal] = useState(0);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [due, setDue] = useState<RecurringExpense[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const enter = useSessionOnce("hl-home-enter");
  const added = params.get("added");
  const today = todayISO();

  const loadMonth = useCallback(async () => {
    if (!household) return;
    const supabase = createClient();
    setBusy(true);
    setError(false);
    const monday = startOfWeek(today);
    const sunday = shiftISO(monday, 6);
    try {
      const [txs, nextBudgets, recurring, prevTotal, weekTxs] = await Promise.all([
        fetchMonthTransactions(supabase, household.id, month),
        listMonthBudgets(supabase, household.id, month),
        listRecurring(supabase, household.id),
        previousMonthTotal(supabase, household.id, month),
        fetchRangeTransactions(supabase, household.id, monday, sunday),
      ]);
      setRows(txs);
      setWeekRows(weekTxs);
      setLastMonthTotal(prevTotal);
      setBudgets(nextBudgets);
      const dueNow = recurring.filter((row) => row.next_on <= today);
      setDue(dueNow);
      if (readNotifyPrefs().recurringReminders && dueNow[0]) {
        notifyIfAllowed("HomeLedger", `${dueNow[0].name} is due. Add it when you are ready.`);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [household, month, today]);

  useEffect(() => {
    if (!household) {
      if (!loading) setBusy(false);
      return;
    }
    void loadMonth();
  }, [household, loadMonth, loading]);

  const summary = summarizeMonth(rows, month);
  const categorySpend = spendByCategory(rows, catalogs.categories);
  const categories = categorySpend.slice(0, 5);
  const recent = rows.slice(0, 5);
  const householdBudget = budgets.find((b) => !b.category_id);
  const categoryBudgets = budgets.filter((b) => b.category_id);
  const week = spendThisWeek(weekRows, today);

  return (
    <PullRefresh
      onRefresh={async () => {
        await refresh();
        await loadMonth();
      }}
    >
    <div className="space-y-7">
      <h1 className="sr-only">Home</h1>

      {!busy && due.length ? (
        <Card className={enter ? "enter enter-1" : undefined}>
          <SectionLabel>Due this month</SectionLabel>
          <ul className="mt-3 space-y-3">
            {due.map((bill) => (
              <li key={bill.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{bill.name}</p>
                  <p className="text-[13px] tabular-nums text-muted">{formatINR(bill.amount)}</p>
                </div>
                <button
                  type="button"
                  className="press min-h-11 shrink-0 rounded-xl px-2 text-[15px] font-semibold text-primary"
                  onClick={async () => {
                    if (!household || !userId) return;
                    const supabase = createClient();
                    const saved = await saveExpense(supabase, household.id, userId, catalogs, {
                      name: bill.name,
                      amount: bill.amount,
                      occurredOn: today,
                      categoryId: bill.category_id,
                      paymentMethodId: bill.payment_method_id,
                      clientRequestId: crypto.randomUUID(),
                    });
                    await markRecurringCreated(supabase, household.id, bill);
                    setDue((cur) => cur.filter((row) => row.id !== bill.id));
                    router.replace(`/home?added=${saved.id}`);
                    await loadMonth();
                  }}
                >
                  Add this month
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {loading || busy ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading this month">
          <div className="skeleton h-28 rounded-[1.25rem]" />
          <div className="skeleton h-40 rounded-[1.25rem]" />
          <div className="skeleton h-28 rounded-[1.25rem]" />
        </div>
      ) : error ? (
        <EmptyState
          title="Something went wrong."
          body="This month could not be loaded."
          action={<PrimaryButton onClick={() => void loadMonth()}>Try again</PrimaryButton>}
        />
      ) : (
        <>
          <div className={enter ? "enter enter-2" : undefined}>
            <OverviewCard
              month={month}
              onMonth={(next) => router.replace(`/home?month=${next}`)}
              total={summary.total}
              previousTotal={lastMonthTotal}
              categories={categories}
            />
          </div>

          {householdBudget ? (
            <section className={enter ? "enter enter-3" : undefined}>
              <BudgetProgress spent={summary.total} limit={householdBudget.amount} />
            </section>
          ) : categoryBudgets.length ? (
            <section className={`space-y-4 ${enter ? "enter enter-3" : ""}`}>
              {categoryBudgets.slice(0, 3).map((budget) => {
                const name = catalogs.categories.find((c) => c.id === budget.category_id)?.name ?? "Category";
                const spent = categorySpend.find((row) => row.category.id === budget.category_id)?.total ?? 0;
                return <BudgetProgress key={budget.id} spent={spent} limit={budget.amount} label={name} />;
              })}
            </section>
          ) : null}

          <div className={enter ? "enter enter-4" : undefined}>
            <WeekChart days={week} today={today} />
          </div>

          <div className={enter ? "enter enter-5" : undefined}>
            <QuickAddGrid />
          </div>

          {recent.length ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <SectionLabel>Recent</SectionLabel>
                <Link href={`/transactions?month=${month}`} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary">
                  View all
                </Link>
              </div>
              <div className="overflow-hidden rounded-[1.25rem] border border-line bg-surface px-4">
              {recent.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  showDate
                  highlight={tx.id === added}
                  onDeleted={(id) => setRows((cur) => cur.filter((row) => row.id !== id))}
                />
              ))}
              </div>
            </section>
          ) : (
            <p className="text-center text-[14px] text-muted">
              Add milk, groceries, or a bill to start this month.
            </p>
          )}

          {categories.length ? (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <SectionLabel>Spending by category</SectionLabel>
                <Link href={`/reports?month=${month}`} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary">
                  View report
                </Link>
              </div>
              <CategoryBars rows={categories} onSelect={(id) => router.push(`/reports/category/${id}?month=${month}`)} />
            </section>
          ) : null}
        </>
      )}
    </div>
    </PullRefresh>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
