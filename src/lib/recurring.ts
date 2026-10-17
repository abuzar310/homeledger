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

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd, 23rd. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

/** The database only allows 1–28, so a bill lands on a real date every month. */
export function isValidBillDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 28;
}

/**
 * The same bill and due date always give the same id, so tapping "Add this month" twice, on two
 * phones, or again after a failed step hits saveExpense's dedupe instead of booking it twice.
 */
export async function occurrenceRequestId(bill: Pick<RecurringExpense, "id" | "next_on">): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${bill.id}:${bill.next_on}`));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The due date after `nextOn`, e.g. October's bill moves to November even if added in November. */
export function followingDueOn(dayOfMonth: number, nextOn: string): string {
  return nextDueOn(dayOfMonth, `${nextMonthKey(nextOn.slice(0, 7))}-01`);
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
  try {
    localStorage.setItem(localKey(householdId), JSON.stringify(rows));
  } catch {
    /* storage blocked */
  }
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
  const legacy = readLocal(householdId);
  if (error) return legacy.map(asRow);
  // Older versions kept a bill only on this phone when the insert failed; keep showing those.
  const ids = new Set((data ?? []).map((row) => row.id));
  return [...((data ?? []) as RecurringExpense[]), ...legacy.filter((row) => !ids.has(row.id))]
    .map(asRow)
    .sort((a, b) => a.next_on.localeCompare(b.next_on));
}

export async function saveRecurring(
  supabase: SupabaseClient,
  householdId: string,
  input: { name: string; amount: number; dayOfMonth: number; categoryId?: string | null; notes?: string },
): Promise<RecurringExpense> {
  if (!isValidBillDay(input.dayOfMonth)) throw new Error("Day of month must be 1–28");
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
  if (error) throw error;
  return row;
}

export async function deleteRecurring(supabase: SupabaseClient, householdId: string, id: string) {
  const local = readLocal(householdId);
  if (local.some((row) => row.id === id)) writeLocal(householdId, local.filter((row) => row.id !== id));
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function markRecurringCreated(
  supabase: SupabaseClient,
  householdId: string,
  row: RecurringExpense,
  on = todayISO(),
) {
  const next_on = followingDueOn(row.day_of_month, row.next_on);
  // Only moves on from the due date this phone saw, so two phones cannot skip a month.
  const { data, error } = await supabase
    .from("recurring_expenses")
    .update({ last_created_on: on, next_on })
    .eq("id", row.id)
    .eq("next_on", row.next_on)
    .select("id");
  if (error) throw error;
  if (data?.length) return;
  // No row moved: another phone already did it, or this is a bill kept only on this phone.
  const local = readLocal(householdId);
  if (local.some((item) => item.id === row.id)) {
    writeLocal(
      householdId,
      local.map((item) =>
        item.id === row.id && item.next_on === row.next_on ? { ...item, last_created_on: on, next_on } : item,
      ),
    );
  }
}
