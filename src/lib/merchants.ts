import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMerchantName } from "@/lib/categorization/rules";
import { clearMonthCache } from "@/lib/reports";

export const MERCHANT_NAME_MAX = 60;

export function cleanMerchantName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Why this name can't be used, or null. `clash` is another merchant already using it (merge instead). */
export function merchantNameCheck(
  raw: string,
  others: { id: string; name: string; normalized_name: string }[],
  selfId: string,
): { error: string | null; clash: { id: string; name: string } | null } {
  const name = cleanMerchantName(raw);
  if (!name) return { error: "Enter a name.", clash: null };
  if (name.length > MERCHANT_NAME_MAX) return { error: `Keep it to ${MERCHANT_NAME_MAX} characters or fewer.`, clash: null };
  const key = normalizeMerchantName(name);
  const clash = others.find((row) => row.id !== selfId && row.normalized_name === key) ?? null;
  return { error: null, clash };
}

function compact(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Pairs that look like the same store typed two ways: equal once spaces and punctuation are gone
 * ("D-Mart" / "DMart"), or one name starting the other ("Nandini" / "Nandini Milk Parlour").
 */
export function likelyDuplicates<T extends { id: string; name: string }>(merchants: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  const keyed = merchants.map((m) => ({ m, key: compact(m.name) })).filter((row) => row.key.length >= 3);
  for (let i = 0; i < keyed.length; i++) {
    for (let j = i + 1; j < keyed.length; j++) {
      const [a, b] = keyed[i].key.length <= keyed[j].key.length ? [keyed[i], keyed[j]] : [keyed[j], keyed[i]];
      if (a.key === b.key || (a.key.length >= 4 && b.key.startsWith(a.key))) pairs.push([a.m, b.m]);
    }
  }
  return pairs;
}

// RLS hides rows it refuses instead of raising, so an empty result means nothing changed.
function changed(data: unknown[] | null, what: string) {
  if (!data?.length) throw new Error(`${what} did not change. Refresh and try again.`);
}

export async function renameMerchant(supabase: SupabaseClient, householdId: string, id: string, raw: string) {
  const name = cleanMerchantName(raw);
  const { data, error } = await supabase
    .from("merchants")
    .update({ name, normalized_name: normalizeMerchantName(name) })
    .eq("id", id)
    .eq("household_id", householdId)
    .select("id");
  if (error) throw error;
  changed(data, "The name");
  clearMonthCache();
}

/** The category new expenses from this merchant are filed under (null = learn from expenses). */
export async function setMerchantDefault(
  supabase: SupabaseClient,
  householdId: string,
  id: string,
  categoryId: string | null,
  subcategoryId: string | null,
) {
  const { data, error } = await supabase
    .from("merchants")
    .update({ default_category_id: categoryId, default_subcategory_id: categoryId ? subcategoryId : null })
    .eq("id", id)
    .eq("household_id", householdId)
    .select("id");
  if (error) throw error;
  changed(data, "The default category");
}

/**
 * Moves every expense from `fromId` to `intoId`, then removes `fromId`. The move is one UPDATE, so
 * it either all happens or none of it does; if the removal then fails, the old merchant is just empty.
 */
export async function mergeMerchants(supabase: SupabaseClient, householdId: string, fromId: string, intoId: string) {
  if (fromId === intoId) throw new Error("Pick a different merchant.");
  const { error: moveError } = await supabase
    .from("transactions")
    .update({ merchant_id: intoId })
    .eq("household_id", householdId)
    .eq("merchant_id", fromId);
  if (moveError) throw moveError;
  clearMonthCache();
  await deleteMerchant(supabase, householdId, fromId);
}

/** Removes a merchant; its expenses stay, without a merchant (the foreign key sets it to null). */
export async function deleteMerchant(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("merchants").delete().eq("id", id).eq("household_id", householdId).select("id");
  if (error) throw error;
  changed(data, "The merchant");
  clearMonthCache();
}
