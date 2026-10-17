"use client";

import { useEffect, useState } from "react";
import { BudgetProgress } from "@/components/BudgetProgress";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { effectiveBudgets, listBudgetHistory, upsertMonthBudget } from "@/lib/budgets";
import { formatMonthLabel, monthKey, monthStart, todayISO } from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import { fetchMonthTransactions, spendByCategory, sum } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import type { Budget, Transaction } from "@/lib/types";

export default function BudgetsPage() {
  const { household, catalogs } = useHousehold();
  const month = monthKey();
  const [history, setHistory] = useState<Budget[]>([]);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function load() {
    if (!household) return;
    setBusy(true);
    setError(false);
    try {
      const supabase = createClient();
      const [nextHistory, txs] = await Promise.all([
        listBudgetHistory(supabase, household.id, month),
        fetchMonthTransactions(supabase, household.id, month),
      ]);
      setHistory(nextHistory);
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
  // Rows saved for this month (what a save updates) vs. what applies now, carried-over included.
  const own = history.filter((b) => b.year_month === monthStart(month));
  const budgets = effectiveBudgets(history, month);
  const householdBudget = budgets.find((b) => !b.category_id);
  const categoryBudgets = budgets.filter((b) => b.category_id);

  async function save(amountValue: number, slot: string | null) {
    if (!household) return;
    await upsertMonthBudget(createClient(), household.id, month, amountValue, slot, own);
    await load();
  }

  async function remove(budget: Budget) {
    if (removing) return;
    setRemoving(budget.id);
    setSaveError(null);
    try {
      // A 0 budget for this month ends the carry-over for that slot.
      await save(0, budget.category_id);
    } catch {
      setSaveError("Could not remove the budget. Try again.");
    } finally {
      setRemoving(null);
    }
  }

  function carriedNote(budget: Budget) {
    if (budget.year_month === monthStart(month)) return null;
    return <p className="mt-1 text-[13px] text-muted">Carried over from {formatMonthLabel(budget.year_month.slice(0, 7))}</p>;
  }

  function removeButton(budget: Budget) {
    return (
      <button
        type="button"
        className="min-h-11 text-[14px] font-semibold text-muted"
        disabled={removing === budget.id}
        onClick={() => void remove(budget)}
      >
        {removing === budget.id ? "Removing…" : "Remove"}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <ScreenTitle title="Budgets" />
      <p className="text-[15px] text-muted">Set a monthly limit once. It carries over to the next months until you change it, and never blocks spending.</p>

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
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold">Monthly budget</h2>
                {removeButton(householdBudget)}
              </div>
              <BudgetProgress spent={total} limit={householdBudget.amount} month={month} today={todayISO()} />
              {carriedNote(householdBudget)}
            </Card>
          ) : null}

          {categoryBudgets.length ? (
            <Card className="space-y-4">
              <h2 className="text-[16px] font-semibold">Category budgets</h2>
              {categoryBudgets.map((budget) => {
                const name = catalogs.categories.find((c) => c.id === budget.category_id)?.name ?? "Category";
                const spent = byCategory.find((row) => row.category.id === budget.category_id)?.total ?? 0;
                return (
                  <div key={budget.id}>
                    <BudgetProgress spent={spent} limit={budget.amount} label={name} month={month} today={todayISO()} />
                    <div className="flex items-center justify-between gap-3">
                      {carriedNote(budget) ?? <span />}
                      {removeButton(budget)}
                    </div>
                  </div>
                );
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
        {saveError ? (
          <p className="text-[15px] text-danger" role="alert">
            {saveError}
          </p>
        ) : null}
        <PrimaryButton
          disabled={saving}
          onClick={async () => {
            if (!household || saving) return;
            const parsed = parseAmount(amount);
            if (parsed == null || parsed <= 0) {
              setSaveError("Enter a valid amount");
              return;
            }
            setSaving(true);
            setSaveError(null);
            try {
              await save(parsed, categoryId || null);
              setAmount("");
            } catch {
              setSaveError("Could not save the budget. Try again.");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save budget"}
        </PrimaryButton>
      </Card>
    </div>
  );
}
