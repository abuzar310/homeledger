import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalogs, Category, Household, PaymentMethod, Subcategory } from "@/lib/types";

export async function ensureHousehold(supabase: SupabaseClient): Promise<Household> {
  const { data, error } = await supabase.rpc("ensure_household");
  if (error) throw error;
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("*")
    .eq("id", data)
    .single();
  if (householdError || !household) throw householdError ?? new Error("Household not found");
  return household as Household;
}

export async function loadCatalogs(supabase: SupabaseClient): Promise<Catalogs> {
  const [categories, subcategories, paymentMethods] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("subcategories").select("*").order("sort_order"),
    supabase.from("payment_methods").select("*").order("sort_order"),
  ]);
  if (categories.error) throw categories.error;
  if (subcategories.error) throw subcategories.error;
  if (paymentMethods.error) throw paymentMethods.error;
  return {
    categories: (categories.data ?? []) as Category[],
    subcategories: (subcategories.data ?? []) as Subcategory[],
    paymentMethods: (paymentMethods.data ?? []) as PaymentMethod[],
  };
}
