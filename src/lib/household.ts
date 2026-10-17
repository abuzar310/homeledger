import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalogs, Category, Household, PaymentMethod, Subcategory } from "@/lib/types";

export async function ensureHousehold(supabase: SupabaseClient): Promise<Household> {
  const { data, error } = await supabase.rpc("ensure_household");
  if (error) throw error;
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("id, name, created_by, created_at")
    .eq("id", data)
    .single();
  if (householdError || !household) throw householdError ?? new Error("Household not found");
  return household as Household;
}

/** household_members.id -> the name to show: profile name, then the name saved on joining. */
export async function listMemberNames(supabase: SupabaseClient, householdId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("household_members")
    .select("id, user_id, display_name")
    .eq("household_id", householdId);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; user_id: string; display_name: string | null }[];
  const { data: profiles } = rows.length
    ? await supabase.from("profiles").select("id, full_name").in("id", rows.map((row) => row.user_id))
    : { data: [] };
  const fullNames = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  return new Map(rows.map((row) => [row.id, fullNames.get(row.user_id) || row.display_name || "Member"]));
}

const HOME_CACHE = "hl-home";

/** The last home this phone loaded, so the app can still open (and queue expenses) offline. */
export type HomeSnapshot = {
  userId: string;
  user: unknown;
  household: Household;
  catalogs: Catalogs;
  profile: unknown;
};

export function readHomeSnapshot(): HomeSnapshot | null {
  try {
    const snap = JSON.parse(localStorage.getItem(HOME_CACHE) || "null") as HomeSnapshot | null;
    return snap?.userId && snap.household?.id ? snap : null;
  } catch {
    return null;
  }
}

export function writeHomeSnapshot(snap: HomeSnapshot) {
  try {
    localStorage.setItem(HOME_CACHE, JSON.stringify(snap));
  } catch {
    /* storage full or blocked: offline opens just won't have it */
  }
}

/** On sign-out: shared phones must not keep the last person's home. */
export function clearHomeSnapshot() {
  try {
    localStorage.removeItem(HOME_CACHE);
  } catch {
    /* ignore */
  }
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
