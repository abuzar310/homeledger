import type { SupabaseClient } from "@supabase/supabase-js";
import {
  daysElapsedInMonth,
  daysInMonth,
  monthEnd,
  monthStart,
  previousMonth,
  startOfWeek,
  todayISO,
  weekDays,
  weekdayShort,
} from "@/lib/dates";
import type { Category, Merchant, Transaction } from "@/lib/types";

export type MonthSummary = {
  total: number;
  count: number;
  todayTotal: number;
  dailyAverage: number;
  previousTotal: number;
};

export type CategorySpend = {
  category: Category;
  total: number;
  percent: number;
};

export type MerchantSpend = {
  merchant: Merchant;
  total: number;
  count: number;
};

const MONTH_MS = 60 * 1000;
const monthMemo = new Map<string, { at: number; rows: Transaction[] }>();
const prevMemo = new Map<string, { at: number; total: number }>();
const dailyMemo = new Map<string, { at: number; days: Map<string, number> }>();

export function clearMonthCache() {
  monthMemo.clear();
  prevMemo.clear();
  dailyMemo.clear();
}

/** Spend per day (ISO date -> total) for a date range. Pages past the API's 1,000-row cap. */
export async function fetchDailyTotals(
  supabase: SupabaseClient,
  householdId: string,
  from: string,
  to: string,
): Promise<Map<string, number>> {
  const key = `${householdId}:${from}:${to}`;
  const hit = dailyMemo.get(key);
  if (hit && Date.now() - hit.at < MONTH_MS) return hit.days;
  const PAGE = 1000;
  const days = new Map<string, number>();
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("amount, occurred_on")
      .eq("household_id", householdId)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("id")
      .range(start, start + PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      days.set(row.occurred_on, (days.get(row.occurred_on) ?? 0) + Number(row.amount));
    }
    if (!data || data.length < PAGE) break;
  }
  dailyMemo.set(key, { at: Date.now(), days });
  return days;
}

export function dailyFromRows(rows: { amount: number; occurred_on: string }[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const row of rows) days.set(row.occurred_on, (days.get(row.occurred_on) ?? 0) + row.amount);
  return days;
}

/** The `count` months ending at `month`, oldest first. */
export function monthsBack(month: string, count: number): string[] {
  const out = [month];
  while (out.length < count) out.unshift(previousMonth(out[0]));
  return out;
}

export function monthTotals(days: Map<string, number>, months: string[]): { month: string; total: number }[] {
  const totals = new Map(months.map((m) => [m, 0]));
  for (const [iso, total] of days) {
    const m = iso.slice(0, 7);
    if (totals.has(m)) totals.set(m, totals.get(m)! + total);
  }
  return months.map((m) => ({ month: m, total: totals.get(m)! }));
}

/** Running total for each day 1..upTo of `month` (index 0 = day 1). */
export function cumulativeDaily(days: Map<string, number>, month: string, upTo = daysInMonth(month)): number[] {
  const out: number[] = [];
  let running = 0;
  for (let d = 1; d <= upTo; d++) {
    running += days.get(`${month}-${String(d).padStart(2, "0")}`) ?? 0;
    out.push(running);
  }
  return out;
}

/** How many days of `month` have happened by `today`: all of a past month, none of a future one. */
export function daysSoFar(month: string, today = todayISO()): number {
  const current = today.slice(0, 7);
  if (month < current) return daysInMonth(month);
  if (month > current) return 0;
  return Number(today.slice(8));
}

export type ShareRow = { id: string; name: string; total: number; percent: number };

export function spendByPaymentMethod(transactions: Transaction[]): ShareRow[] {
  const map = new Map<string, ShareRow>();
  for (const tx of transactions) {
    const id = tx.payment_method?.id ?? "none";
    const name = tx.payment_method?.name ?? "Not set";
    const row = map.get(id) ?? { id, name, total: 0, percent: 0 };
    row.total += tx.amount;
    map.set(id, row);
  }
  const total = sum(transactions) || 1;
  return [...map.values()]
    .map((row) => ({ ...row, percent: Math.round((row.total / total) * 100) }))
    .sort((a, b) => b.total - a.total);
}

export async function fetchMonthTransactions(
  supabase: SupabaseClient,
  householdId: string,
  month: string,
  categoryId?: string,
): Promise<Transaction[]> {
  const key = `${householdId}:${month}:${categoryId ?? ""}`;
  const hit = monthMemo.get(key);
  if (hit && Date.now() - hit.at < MONTH_MS) return hit.rows;

  let query = supabase
    .from("transactions")
    .select(
      "id, household_id, name, amount, occurred_on, category_id, subcategory_id, merchant_id, payment_method_id, notes, needs_review, category:categories(id, name, color, group_name), subcategory:subcategories(id, name), merchant:merchants(id, name), payment_method:payment_methods(id, name)",
    )
    .eq("household_id", householdId)
    .gte("occurred_on", monthStart(month))
    .lte("occurred_on", monthEnd(month));
  if (categoryId) query = query.eq("category_id", categoryId);
  const { data, error } = await query
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  const rows = (data ?? []).map((tx) => ({ ...tx, amount: Number(tx.amount) })) as unknown as Transaction[];
  monthMemo.set(key, { at: Date.now(), rows });
  return rows;
}

export function summarizeMonth(transactions: Transaction[], month: string, today = todayISO()): MonthSummary {
  const total = sum(transactions);
  const todayTotal = sum(transactions.filter((t) => t.occurred_on === today));
  const elapsed = Math.max(1, daysElapsedInMonth(month, today));
  return {
    total,
    count: transactions.length,
    todayTotal,
    dailyAverage: total / elapsed,
    previousTotal: 0,
  };
}

export function spendByCategory(transactions: Transaction[], categories: Category[]): CategorySpend[] {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    const key = tx.category_id ?? "other";
    totals.set(key, (totals.get(key) ?? 0) + tx.amount);
  }
  const total = sum(transactions) || 1;
  return [...totals.entries()]
    .map(([id, amount]) => {
      const category =
        categories.find((c) => c.id === id) ??
        ({
          id,
          household_id: null,
          name: "Other",
          group_name: "Other",
          color: "#6B645C",
          sort_order: 999,
          is_system: true,
        } satisfies Category);
      return { category, total: amount, percent: Math.round((amount / total) * 100) };
    })
    .sort((a, b) => b.total - a.total);
}

export function spendByMerchant(transactions: Transaction[]): MerchantSpend[] {
  const map = new Map<string, MerchantSpend>();
  for (const tx of transactions) {
    if (!tx.merchant) continue;
    const current = map.get(tx.merchant.id);
    if (current) {
      current.total += tx.amount;
      current.count += 1;
    } else {
      map.set(tx.merchant.id, { merchant: tx.merchant, total: tx.amount, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export async function previousMonthTotal(
  supabase: SupabaseClient,
  householdId: string,
  month: string,
): Promise<number> {
  const prev = previousMonth(month);
  const key = `${householdId}:${prev}`;
  const hit = prevMemo.get(key);
  if (hit && Date.now() - hit.at < MONTH_MS) return hit.total;
  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("household_id", householdId)
    .gte("occurred_on", monthStart(prev))
    .lte("occurred_on", monthEnd(prev));
  if (error) throw error;
  const total = sum((data ?? []).map((row) => ({ amount: Number(row.amount) })));
  prevMemo.set(key, { at: Date.now(), total });
  return total;
}

export function sum(rows: { amount: number }[]): number {
  return rows.reduce((acc, row) => acc + Number(row.amount || 0), 0);
}

export type WeekDaySpend = {
  iso: string;
  label: string;
  total: number;
};

export async function fetchRangeTransactions(
  supabase: SupabaseClient,
  householdId: string,
  from: string,
  to: string,
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, household_id, name, amount, occurred_on, category_id, subcategory_id, merchant_id, payment_method_id, notes, needs_review, category:categories(id, name, color, group_name), subcategory:subcategories(id, name), merchant:merchants(id, name), payment_method:payment_methods(id, name)",
    )
    .eq("household_id", householdId)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return ((data ?? []).map((tx) => ({ ...tx, amount: Number(tx.amount) })) as unknown as Transaction[]);
}

export function spendThisWeek(transactions: Transaction[], today = todayISO()): WeekDaySpend[] {
  const monday = startOfWeek(today);
  const days = weekDays(monday);
  return days.map((iso) => ({
    iso,
    label: weekdayShort(iso),
    total: sum(transactions.filter((tx) => tx.occurred_on === iso)),
  }));
}
