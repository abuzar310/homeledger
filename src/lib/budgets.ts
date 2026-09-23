import type { SupabaseClient } from "@supabase/supabase-js";
import { monthStart } from "@/lib/dates";
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

export function budgetProgress(spent: number, limit: number) {
  const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  return {
    percent,
    remaining: Math.max(0, limit - spent),
    over: spent > limit,
  };
}
