"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { formatMonthLabel, monthKey, monthStart } from "@/lib/dates";
import { formatINR, parseAmount } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import type { Budget } from "@/lib/types";

export default function BudgetsPage() {
  const { household, catalogs } = useHousehold();
  const month = monthKey();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");

  async function load() {
    if (!household) return;
    const { data } = await createClient()
      .from("budgets")
      .select("*")
      .eq("household_id", household.id)
      .eq("year_month", monthStart(month));
    setBudgets(((data ?? []) as Budget[]).map((b) => ({ ...b, amount: Number(b.amount) })));
  }

  useEffect(() => {
    if (!household) return;
    const supabase = createClient();
    supabase
      .from("budgets")
      .select("*")
      .eq("household_id", household.id)
      .eq("year_month", monthStart(month))
      .then(({ data }) => {
        setBudgets(((data ?? []) as Budget[]).map((b) => ({ ...b, amount: Number(b.amount) })));
      });
  }, [household, month]);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Budgets" />
      <p className="text-[15px] text-muted">Set a simple monthly limit. This does not block spending.</p>
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
            await createClient().from("budgets").upsert({
              household_id: household.id,
              category_id: categoryId || null,
              year_month: monthStart(month),
              amount: parsed,
            });
            setAmount("");
            await load();
          }}
        >
          Save budget
        </PrimaryButton>
      </Card>
      <Card>
        {!budgets.length ? (
          <p className="text-muted">No budgets set for this month.</p>
        ) : (
          <ul>
            {budgets.map((budget) => (
              <li key={budget.id} className="flex justify-between border-b border-line py-3 last:border-0">
                <span>{catalogs.categories.find((c) => c.id === budget.category_id)?.name ?? "Whole household"}</span>
                <span className="tabular-nums">{formatINR(budget.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
