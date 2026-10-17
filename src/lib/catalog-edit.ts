import type { SupabaseClient } from "@supabase/supabase-js";

/** Colours the built-in categories already use, so a custom one sits in the same family. */
export const CATEGORY_COLORS = [
  { hex: "#3F7D5A", name: "Green" },
  { hex: "#C46A3A", name: "Orange" },
  { hex: "#3F6B8A", name: "Blue" },
  { hex: "#8A4E5C", name: "Plum" },
  { hex: "#5A5E8A", name: "Indigo" },
  { hex: "#6B5A8A", name: "Purple" },
  { hex: "#7A6A4E", name: "Brown" },
  { hex: "#6B645C", name: "Grey" },
];

/** The Categories screen lists a household's own categories under this group. */
export const CUSTOM_GROUP = "My categories";

export const CATALOG_NAME_MAX = 40;

type CatalogTable = "categories" | "payment_methods";

/**
 * Built-in rows have no household and stay read-only. RLS lets a household change only its own
 * non-system rows, so the screens offer edits for exactly those.
 */
export function isOwnRow(row: { household_id: string | null; is_system: boolean }, householdId: string | null | undefined) {
  return Boolean(householdId) && row.household_id === householdId && !row.is_system;
}

export function cleanCatalogName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Why this name cannot be saved, or null when it can. Names are compared without case. */
export function catalogNameError(raw: string, existing: { id: string; name: string }[], exceptId?: string): string | null {
  const name = cleanCatalogName(raw);
  if (!name) return "Enter a name.";
  if (name.length > CATALOG_NAME_MAX) return `Keep the name to ${CATALOG_NAME_MAX} characters or fewer.`;
  const key = name.toLocaleLowerCase();
  if (existing.some((row) => row.id !== exceptId && cleanCatalogName(row.name).toLocaleLowerCase() === key)) {
    return `${name} is already in the list.`;
  }
  return null;
}

/** New rows go after everything already listed. */
export function nextSortOrder(rows: { sort_order: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.sort_order), 0) + 10;
}

export async function addCatalogRow(
  supabase: SupabaseClient,
  table: CatalogTable,
  householdId: string,
  fields: Record<string, string | number>,
) {
  const { error } = await supabase.from(table).insert({ ...fields, household_id: householdId, is_system: false });
  if (error) throw error;
}

export async function updateCatalogRow(
  supabase: SupabaseClient,
  table: CatalogTable,
  householdId: string,
  id: string,
  fields: Record<string, string | number>,
) {
  const { data, error } = await supabase
    .from(table)
    .update(fields)
    .eq("id", id)
    .eq("household_id", householdId)
    .eq("is_system", false)
    .select("id");
  if (error) throw error;
  // RLS hides a refused row instead of raising, so an empty result means nothing changed.
  if (!data?.length) throw new Error("Nothing was changed.");
}

export async function deleteCatalogRow(supabase: SupabaseClient, table: CatalogTable, householdId: string, id: string) {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("household_id", householdId)
    .eq("is_system", false)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Nothing was deleted.");
}
