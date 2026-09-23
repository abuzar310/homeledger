import type { SupabaseClient } from "@supabase/supabase-js";
import { daysInMonth, todayISO } from "@/lib/dates";

export type RecurringExpense = {
  id: string;
  household_id: string;
  name: string;
  amount: number;
  category_id: string | null;
  payment_method_id: string | null;
  cadence: "monthly";
  day_of_month: number;
  next_on: string;
  notes: string | null;
  last_created_on: string | null;
};

export function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function nextDueOn(dayOfMonth: number, from = todayISO()): string {
  const day = Math.min(28, Math.max(1, Math.round(dayOfMonth)));
  const key = from.slice(0, 7);
  const candidate = `${key}-${String(Math.min(day, daysInMonth(key))).padStart(2, "0")}`;
  if (candidate >= from) return candidate;
  const later = nextMonthKey(key);
  return `${later}-${String(Math.min(day, daysInMonth(later))).padStart(2, "0")}`;
}

function localKey(householdId: string) {
  return `hl-recurring:${householdId}`;
}

function readLocal(householdId: string): RecurringExpense[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(householdId)) || "[]") as RecurringExpense[];
  } catch {
    return [];
  }
}

function writeLocal(householdId: string, rows: RecurringExpense[]) {
  localStorage.setItem(localKey(householdId), JSON.stringify(rows));
}

function asRow(row: RecurringExpense): RecurringExpense {
  return { ...row, amount: Number(row.amount) };
}

export async function listRecurring(
  supabase: SupabaseClient,
  householdId: string,
): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select(
      "id, household_id, name, amount, category_id, payment_method_id, cadence, day_of_month, next_on, notes, last_created_on",
    )
    .eq("household_id", householdId)
    .order("next_on");
  if (error) return readLocal(householdId);
  return ((data ?? []) as RecurringExpense[]).map(asRow);
}

export async function saveRecurring(
  supabase: SupabaseClient,
  householdId: string,
  input: { name: string; amount: number; dayOfMonth: number; categoryId?: string | null; notes?: string },
): Promise<RecurringExpense> {
  const row: RecurringExpense = {
    id: crypto.randomUUID(),
    household_id: householdId,
    name: input.name.trim(),
    amount: input.amount,
    category_id: input.categoryId ?? null,
    payment_method_id: null,
    cadence: "monthly",
    day_of_month: input.dayOfMonth,
    next_on: nextDueOn(input.dayOfMonth),
    notes: input.notes?.trim() || null,
    last_created_on: null,
  };
  const { error } = await supabase.from("recurring_expenses").insert(row);
  if (error) {
    writeLocal(householdId, [...readLocal(householdId), row]);
  }
  return row;
}

export async function deleteRecurring(supabase: SupabaseClient, householdId: string, id: string) {
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) writeLocal(householdId, readLocal(householdId).filter((row) => row.id !== id));
}

export async function markRecurringCreated(
  supabase: SupabaseClient,
  householdId: string,
  row: RecurringExpense,
  on = todayISO(),
) {
  const next_on = nextDueOn(row.day_of_month, nextMonthKey(on.slice(0, 7)) + "-01");
  const { error } = await supabase
    .from("recurring_expenses")
    .update({ last_created_on: on, next_on })
    .eq("id", row.id);
  if (error) {
    writeLocal(
      householdId,
      readLocal(householdId).map((item) =>
        item.id === row.id ? { ...item, last_created_on: on, next_on } : item,
      ),
    );
  }
}
