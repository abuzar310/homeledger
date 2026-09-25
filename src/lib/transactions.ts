import type { SupabaseClient } from "@supabase/supabase-js";
import { categorizeExpense } from "@/lib/categorization";
import { normalizeMerchantName } from "@/lib/categorization/rules";
import { clearMonthCache } from "@/lib/reports";
import type { Catalogs, Merchant, PurchaseChannel, Transaction, TransactionItem } from "@/lib/types";

const TX_SELECT = `
  *,
  category:categories(*),
  subcategory:subcategories(*),
  merchant:merchants(*),
  payment_method:payment_methods(*),
  items:transaction_items(*),
  receipts(*)
`;

const TX_LIST_SELECT = `
  id, household_id, name, amount, occurred_on, category_id, subcategory_id,
  merchant_id, payment_method_id, purchase_channel, notes, needs_review,
  categorization_source, created_at,
  category:categories(id, name, color, group_name),
  subcategory:subcategories(id, name),
  merchant:merchants(id, name),
  payment_method:payment_methods(id, name)
`;

export type TransactionFilters = {
  month?: string;
  from?: string;
  to?: string;
  query?: string;
  categoryId?: string;
  subcategoryId?: string;
  merchantId?: string;
  paymentMethodId?: string;
  channel?: PurchaseChannel | "";
  minAmount?: number | null;
  maxAmount?: number | null;
};

export type SaveExpenseInput = {
  name: string;
  amount: number;
  occurredOn: string;
  notes?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  merchantName?: string;
  paymentMethodId?: string | null;
  purchaseChannel?: PurchaseChannel | null;
  items?: { name: string; amount: number }[];
  clientRequestId: string;
  userCategorized?: boolean;
};

export async function listTransactions(
  supabase: SupabaseClient,
  householdId: string,
  filters: TransactionFilters,
  page = 0,
  pageSize = 30,
): Promise<Transaction[]> {
  let query = supabase
    .from("transactions")
    .select(TX_LIST_SELECT)
    .eq("household_id", householdId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (filters.from) query = query.gte("occurred_on", filters.from);
  if (filters.to) query = query.lte("occurred_on", filters.to);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.subcategoryId) query = query.eq("subcategory_id", filters.subcategoryId);
  if (filters.merchantId) query = query.eq("merchant_id", filters.merchantId);
  if (filters.paymentMethodId) query = query.eq("payment_method_id", filters.paymentMethodId);
  if (filters.channel) query = query.eq("purchase_channel", filters.channel);
  if (filters.minAmount != null) query = query.gte("amount", filters.minAmount);
  if (filters.maxAmount != null) query = query.lte("amount", filters.maxAmount);

  const q = sanitizeSearchTerm(filters.query);
  if (q) {
    const { data: merchants } = await supabase
      .from("merchants")
      .select("id")
      .eq("household_id", householdId)
      .ilike("name", `%${q}%`);
    const merchantIds = (merchants ?? []).map((m) => m.id);
    const ors = [`name.ilike.%${q}%`, `notes.ilike.%${q}%`];
    if (merchantIds.length) ors.push(`merchant_id.in.(${merchantIds.join(",")})`);
    query = query.or(ors.join(","));
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as Transaction[]).map(normalizeTx);
}

export function sanitizeSearchTerm(raw?: string | null): string {
  return (raw ?? "").replace(/[%_(),.*"'\\]/g, " ").replace(/\s+/g, " ").trim();
}

export async function getTransaction(
  supabase: SupabaseClient,
  id: string,
  householdId?: string,
): Promise<Transaction | null> {
  let query = supabase.from("transactions").select(TX_SELECT).eq("id", id);
  if (householdId) query = query.eq("household_id", householdId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? normalizeTx(data as Transaction) : null;
}

export async function saveExpense(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  catalogs: Catalogs,
  input: SaveExpenseInput,
): Promise<Transaction> {
  const { data: existing } = await supabase
    .from("transactions")
    .select(TX_SELECT)
    .eq("client_request_id", input.clientRequestId)
    .maybeSingle();
  if (existing) return normalizeTx(existing as Transaction);

  const { data: merchants } = await supabase
    .from("merchants")
    .select("id, household_id, name, normalized_name, default_category_id, default_subcategory_id, default_channel")
    .eq("household_id", householdId);
  const suggestion = input.userCategorized
    ? null
    : await categorizeExpense(
        { name: input.name, notes: input.notes, merchantName: input.merchantName },
        catalogs,
        (merchants ?? []) as Merchant[],
      );

  const merchantName = input.merchantName?.trim() || suggestion?.merchantName || null;
  const merchantId = merchantName
    ? await upsertMerchant(supabase, householdId, merchantName, {
        categoryId: input.categoryId ?? suggestion?.categoryId ?? null,
        subcategoryId: input.subcategoryId ?? suggestion?.subcategoryId ?? null,
        channel: input.purchaseChannel ?? suggestion?.purchaseChannel ?? null,
        remember: Boolean(input.userCategorized),
      })
    : null;

  const { data: member } = await supabase
    .from("household_members")
    .select("id")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  const payload = {
    household_id: householdId,
    member_id: member?.id ?? null,
    created_by: userId,
    name: input.name.trim(),
    amount: input.amount,
    occurred_on: input.occurredOn,
    category_id: input.categoryId ?? suggestion?.categoryId ?? null,
    subcategory_id: input.subcategoryId ?? suggestion?.subcategoryId ?? null,
    merchant_id: merchantId,
    payment_method_id: input.paymentMethodId ?? suggestion?.paymentMethodId ?? null,
    purchase_channel: input.purchaseChannel ?? suggestion?.purchaseChannel ?? null,
    notes: input.notes?.trim() || null,
    needs_review: input.userCategorized ? false : Boolean(suggestion?.needsReview),
    categorization_source: input.userCategorized ? "user" : suggestion?.source ?? "none",
    categorization_confidence: input.userCategorized ? 1 : suggestion?.confidence ?? 0,
    client_request_id: input.clientRequestId,
  };

  const { data, error } = await supabase.from("transactions").insert(payload).select(TX_SELECT).single();
  if (error) {
    if (error.code === "23505") {
      const { data: again } = await supabase
        .from("transactions")
        .select(TX_SELECT)
        .eq("client_request_id", input.clientRequestId)
        .single();
      if (again) return normalizeTx(again as Transaction);
    }
    throw error;
  }

  clearMonthCache();

  if (input.items?.length) {
    const rows = input.items
      .filter((item) => item.name.trim() && item.amount > 0)
      .map((item, index) => ({
        transaction_id: data.id,
        name: item.name.trim(),
        amount: item.amount,
        sort_order: index,
      }));
    if (rows.length) {
      const { error: itemError } = await supabase.from("transaction_items").insert(rows);
      if (itemError) throw itemError;
    }
    const saved = await getTransaction(supabase, data.id);
    if (!saved) throw new Error("Could not load saved expense");
    return saved;
  }

  return normalizeTx(data as Transaction);
}

export async function updateExpense(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<{
    name: string;
    amount: number;
    occurred_on: string;
    notes: string | null;
    category_id: string | null;
    subcategory_id: string | null;
    merchant_id: string | null;
    payment_method_id: string | null;
    purchase_channel: PurchaseChannel | null;
    needs_review: boolean;
    categorization_source: Transaction["categorization_source"];
  }>,
): Promise<Transaction> {
  const { error } = await supabase
    .from("transactions")
    .update({ ...patch, categorization_source: patch.categorization_source ?? "user", needs_review: patch.needs_review ?? false })
    .eq("id", id);
  if (error) throw error;
  const saved = await getTransaction(supabase, id);
  if (!saved) throw new Error("Expense not found");
  if (saved.merchant_id && patch.category_id) {
    await supabase
      .from("merchants")
      .update({
        default_category_id: patch.category_id,
        default_subcategory_id: patch.subcategory_id ?? saved.subcategory_id ?? null,
      })
      .eq("id", saved.merchant_id);
  }
  clearMonthCache();
  return saved;
}

export async function deleteExpense(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
  clearMonthCache();
}

export async function replaceItems(
  supabase: SupabaseClient,
  transactionId: string,
  items: { name: string; amount: number }[],
): Promise<void> {
  const { error: delError } = await supabase.from("transaction_items").delete().eq("transaction_id", transactionId);
  if (delError) throw delError;
  const rows = items
    .filter((item) => item.name.trim() && item.amount > 0)
    .map((item, index) => ({
      transaction_id: transactionId,
      name: item.name.trim(),
      amount: item.amount,
      sort_order: index,
    }));
  if (!rows.length) return;
  const { error } = await supabase.from("transaction_items").insert(rows);
  if (error) throw error;
}

export async function upsertMerchant(
  supabase: SupabaseClient,
  householdId: string,
  name: string,
  defaults?: {
    categoryId?: string | null;
    subcategoryId?: string | null;
    channel?: PurchaseChannel | null;
    remember?: boolean;
  },
): Promise<string> {
  const normalized = normalizeMerchantName(name);
  const { data: existing } = await supabase
    .from("merchants")
    .select("id, default_category_id")
    .eq("household_id", householdId)
    .eq("normalized_name", normalized)
    .maybeSingle();
  if (existing) {
    if (defaults?.categoryId && (defaults.remember || !existing.default_category_id)) {
      await supabase
        .from("merchants")
        .update({
          default_category_id: defaults.categoryId,
          default_subcategory_id: defaults.subcategoryId ?? null,
          default_channel: defaults.channel ?? null,
        })
        .eq("id", existing.id);
    }
    return existing.id;
  }
  const { data, error } = await supabase
    .from("merchants")
    .insert({
      household_id: householdId,
      name: name.trim(),
      normalized_name: normalized,
      default_category_id: defaults?.categoryId ?? null,
      default_subcategory_id: defaults?.subcategoryId ?? null,
      default_channel: defaults?.channel ?? null,
    })
    .select("id")
    .single();
  if (error) {
    const { data: again } = await supabase
      .from("merchants")
      .select("id")
      .eq("household_id", householdId)
      .eq("normalized_name", normalized)
      .single();
    if (again) return again.id;
    throw error;
  }
  return data.id;
}

function normalizeTx(tx: Transaction): Transaction {
  return {
    ...tx,
    amount: Number(tx.amount),
    items: (tx.items ?? []).map((item: TransactionItem) => ({ ...item, amount: Number(item.amount) })),
  };
}
