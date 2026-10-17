import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalogs, Category, Household, PaymentMethod, Subcategory } from "@/lib/types";

export function pickActiveHouseholdId(
  ensuredId: string,
  memberships: { household_id: string; created_at: string }[],
): string {
  if (!memberships.length) return ensuredId;
  return [...memberships].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))[0]
    .household_id;
}

export async function ensureHousehold(supabase: SupabaseClient): Promise<Household> {
  const { data, error } = await supabase.rpc("ensure_household");
  if (error) throw error;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: memberships } = user
    ? await supabase
        .from("household_members")
        .select("household_id, created_at")
        .eq("user_id", user.id)
    : { data: [] };
  const hid = pickActiveHouseholdId(String(data), (memberships ?? []) as { household_id: string; created_at: string }[]);
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("id, name, created_by, created_at")
    .eq("id", hid)
    .single();
  if (householdError || !household) throw householdError ?? new Error("Household not found");
  return household as Household;
}

const CATALOG_CACHE = "hl-catalogs";
const CATALOG_MS = 5 * 60 * 1000;

function readCatalogCache(): Catalogs | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CATALOG_CACHE) || "null") as { at?: number; data?: Catalogs } | null;
    if (!parsed?.at || !parsed.data || Date.now() - parsed.at > CATALOG_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCatalogCache(data: Catalogs) {
  try {
    sessionStorage.setItem(CATALOG_CACHE, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore quota */
  }
}

export function clearCatalogCache() {
  try {
    sessionStorage.removeItem(CATALOG_CACHE);
  } catch {
    /* ignore */
  }
}

export async function loadCatalogs(supabase: SupabaseClient, opts?: { fresh?: boolean }): Promise<Catalogs> {
  if (!opts?.fresh) {
    const cached = readCatalogCache();
    if (cached) return cached;
  }
  const [categories, subcategories, paymentMethods] = await Promise.all([
    supabase.from("categories").select("id, household_id, name, group_name, color, sort_order, is_system").order("sort_order"),
    supabase.from("subcategories").select("id, household_id, category_id, name, sort_order, is_system").order("sort_order"),
    supabase.from("payment_methods").select("id, household_id, name, sort_order, is_system").order("sort_order"),
  ]);
  if (categories.error) throw categories.error;
  if (subcategories.error) throw subcategories.error;
  if (paymentMethods.error) throw paymentMethods.error;
  const data = {
    categories: (categories.data ?? []) as Category[],
    subcategories: (subcategories.data ?? []) as Subcategory[],
    paymentMethods: (paymentMethods.data ?? []) as PaymentMethod[],
  };
  writeCatalogCache(data);
  return data;
}
