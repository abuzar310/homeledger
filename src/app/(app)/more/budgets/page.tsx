"use client";

import { useEffect, useState } from "react";
import { BudgetProgress } from "@/components/BudgetProgress";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { listMonthBudgets, upsertMonthBudget } from "@/lib/budgets";
import { formatMonthLabel, monthKey } from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import { fetchMonthTransactions, spendByCategory, sum } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import type { Budget, Transaction } from "@/lib/types";

export default function BudgetsPage() {
  const { household, catalogs } = useHousehold();
  const month = monthKey();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    if (!household) return;
    setBusy(true);
    setError(false);
    try {
      const supabase = createClient();
      const [nextBudgets, txs] = await Promise.all([
        listMonthBudgets(supabase, household.id, month),
        fetchMonthTransactions(supabase, household.id, month),
      ]);
      setBudgets(nextBudgets);
      setRows(txs);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // ponytail: month is current calendar month; reload when household is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household]);

  const total = sum(rows);
  const byCategory = spendByCategory(rows, catalogs.categories);
  const householdBudget = budgets.find((b) => !b.category_id);
  const categoryBudgets = budgets.filter((b) => b.category_id);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Budgets" />
      <p className="text-[15px] text-muted">Set a simple monthly limit. This does not block spending.</p>

      {busy ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading budgets">
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      ) : error ? (
        <EmptyState
          title="Something went wrong."
          body="Your budgets could not be loaded."
          action={<PrimaryButton onClick={() => void load()}>Try again</PrimaryButton>}
        />
      ) : (
        <>
          {householdBudget ? (
            <Card>
              <h2 className="mb-2 text-[16px] font-semibold">Monthly budget</h2>
              <BudgetProgress spent={total} limit={householdBudget.amount} />
            </Card>
          ) : null}

          {categoryBudgets.length ? (
            <Card className="space-y-4">
              <h2 className="text-[16px] font-semibold">Category budgets</h2>
              {categoryBudgets.map((budget) => {
                const name = catalogs.categories.find((c) => c.id === budget.category_id)?.name ?? "Category";
                const spent = byCategory.find((row) => row.category.id === budget.category_id)?.total ?? 0;
                return <BudgetProgress key={budget.id} spent={spent} limit={budget.amount} label={name} />;
              })}
            </Card>
          ) : null}

          {!budgets.length ? <p className="text-[15px] text-muted">No budgets set for {formatMonthLabel(month)}.</p> : null}
        </>
      )}

      <Card className="space-y-3">
        <p className="font-medium">{formatMonthLabel(month)}</p>
        <Field label="Category">
          <select
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Whole household</option>
            {catalogs.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Monthly amount">
          <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" />
        </Field>
        <PrimaryButton
          onClick={async () => {
            if (!household) return;
            const parsed = parseAmount(amount);
            if (parsed == null) return;
            await upsertMonthBudget(createClient(), household.id, month, parsed, categoryId || null, budgets);
            setAmount("");
            await load();
          }}
        >
          Save budget
        </PrimaryButton>
      </Card>
    </div>
  );
}
