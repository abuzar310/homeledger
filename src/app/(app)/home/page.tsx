"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BudgetProgress } from "@/components/BudgetProgress";
import { CategoryBars } from "@/components/CategoryBars";
import { CountUp } from "@/components/CountUp";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { MonthPicker } from "@/components/MonthPicker";
import { PullRefresh } from "@/components/PullRefresh";
import { TransactionRow } from "@/components/TransactionRow";
import { Card, PrimaryButton, SectionLabel } from "@/components/ui";
import { listMonthBudgets } from "@/lib/budgets";
import { monthKey, todayISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { useSessionOnce } from "@/lib/motion";
import { notifyIfAllowed, readNotifyPrefs } from "@/lib/notify";
import { fetchMonthTransactions, spendByCategory, summarizeMonth } from "@/lib/reports";
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
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [due, setDue] = useState<RecurringExpense[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const enter = useSessionOnce("hl-home-enter");
  const added = params.get("added");

  const loadMonth = useCallback(async () => {
    if (!household) return;
    const supabase = createClient();
    setBusy(true);
    setError(false);
    try {
      const [txs, nextBudgets, recurring] = await Promise.all([
        fetchMonthTransactions(supabase, household.id, month),
        listMonthBudgets(supabase, household.id, month),
        listRecurring(supabase, household.id),
      ]);
      setRows(txs);
      setBudgets(nextBudgets);
      const dueNow = recurring.filter((row) => row.next_on <= todayISO());
      setDue(dueNow);
      if (readNotifyPrefs().recurringReminders && dueNow[0]) {
        notifyIfAllowed("HomeLedger", `${dueNow[0].name} is due. Add it when you are ready.`);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [household, month]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const summary = summarizeMonth(rows, month);
  const categorySpend = spendByCategory(rows, catalogs.categories);
  const categories = categorySpend.slice(0, 5);
  const recent = rows.slice(0, 5);
  const householdBudget = budgets.find((b) => !b.category_id);
  const categoryBudgets = budgets.filter((b) => b.category_id);

  return (
    <PullRefresh
      onRefresh={async () => {
        await refresh();
        await loadMonth();
      }}
    >
    <div className="space-y-7">
      <header className={enter ? "enter enter-1" : undefined}>
        <h1 className="sr-only">Home</h1>
        <MonthPicker
          value={month}
          onChange={(next) => router.replace(`/home?month=${next}`)}
          className="text-[22px] font-semibold tracking-tight"
        />
      </header>

      {!busy && due.length ? (
        <Card className={enter ? "enter enter-2" : undefined}>
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
                      occurredOn: todayISO(),
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
          <div className="skeleton h-16 rounded-[1.25rem]" />
          <div className="skeleton h-24 rounded-[1.25rem]" />
          <div className="skeleton h-40 rounded-[1.25rem]" />
        </div>
      ) : error ? (
        <EmptyState
          title="Something went wrong."
          body="This month could not be loaded."
          action={<PrimaryButton onClick={() => void loadMonth()}>Try again</PrimaryButton>}
        />
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
            <p className="hero-amount">
              <CountUp value={summary.total} />
            </p>
            <p className="mt-2 text-[15px] text-muted">Spent this month</p>
            <div className="ledger-rule mt-3" aria-hidden />
          </section>

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

          <section className={enter ? "enter enter-4" : undefined}>
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

          <section className={enter ? "enter enter-5" : undefined}>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>Spending by category</SectionLabel>
              <Link href={`/reports?month=${month}`} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary">
                View report
              </Link>
            </div>
            <CategoryBars rows={categories} onSelect={(id) => router.push(`/reports/category/${id}?month=${month}`)} />
          </section>
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
