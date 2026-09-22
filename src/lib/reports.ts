import type { SupabaseClient } from "@supabase/supabase-js";
import { daysElapsedInMonth, monthEnd, monthStart, previousMonth, todayISO } from "@/lib/dates";
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

export async function fetchMonthTransactions(
  supabase: SupabaseClient,
  householdId: string,
  month: string,
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, category:categories(*), subcategory:subcategories(*), merchant:merchants(*), payment_method:payment_methods(*)")
    .eq("household_id", householdId)
    .gte("occurred_on", monthStart(month))
    .lte("occurred_on", monthEnd(month))
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []).map((tx) => ({ ...tx, amount: Number(tx.amount) })) as Transaction[];
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
  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("household_id", householdId)
    .gte("occurred_on", monthStart(prev))
    .lte("occurred_on", monthEnd(prev));
  if (error) throw error;
  return sum((data ?? []).map((row) => ({ amount: Number(row.amount) })));
}

export function sum(rows: { amount: number }[]): number {
  return rows.reduce((acc, row) => acc + Number(row.amount || 0), 0);
}
