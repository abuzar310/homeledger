import type { SupabaseClient } from "@supabase/supabase-js";
import { daysInMonth, monthStart } from "@/lib/dates";
import type { Budget } from "@/lib/types";

export async function listMonthBudgets(
  supabase: SupabaseClient,
  householdId: string,
  month: string,
): Promise<Budget[]> {
  const { data, error } = await supabase
    .from("budgets")
    .select("id, household_id, category_id, year_month, amount")
    .eq("household_id", householdId)
    .eq("year_month", monthStart(month));
  if (error) throw error;
  return ((data ?? []) as Budget[]).map((row) => ({ ...row, amount: Number(row.amount) }));
}

export async function upsertMonthBudget(
  supabase: SupabaseClient,
  householdId: string,
  month: string,
  amount: number,
  categoryId?: string | null,
  existing?: Budget[],
): Promise<void> {
  const category_id = categoryId || null;
  // Update the row already set for this month and category; insert only when there is none.
  const current = (existing ?? []).find((row) => (row.category_id || null) === category_id);
  const { error } = current
    ? await supabase.from("budgets").update({ amount }).eq("id", current.id)
    : await supabase
        .from("budgets")
        .insert({ household_id: householdId, category_id, year_month: monthStart(month), amount });
  if (error) throw error;
}

export type BudgetPace = {
  /** Share of the month gone, 0-100: where the "by today" tick sits. */
  elapsedPercent: number;
  /** What the month will end at if spending keeps this daily rate. */
  projected: number;
  /** Day of the month the budget is reached at this rate, when that happens before the month ends. */
  crossDay: number | null;
};

/** Pace for the month in progress; null for past or future months. */
export function budgetPace(spent: number, limit: number, month: string, today: string): BudgetPace | null {
  if (!today.startsWith(month) || limit <= 0) return null;
  const days = daysInMonth(month);
  const elapsed = Number(today.slice(8));
  const daily = spent / elapsed;
  const projected = Math.round(daily * days);
  const cross = daily > 0 ? Math.ceil(limit / daily) : null;
  return {
    elapsedPercent: Math.round((elapsed / days) * 100),
    projected,
    crossDay: spent < limit && cross != null && cross <= days ? cross : null,
  };
}

export function budgetProgress(spent: number, limit: number) {
  const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  return {
    percent,
    remaining: Math.max(0, limit - spent),
    over: spent > limit,
  };
}
