import type { SupabaseClient } from "@supabase/supabase-js";
import type { Receipt } from "@/lib/types";

const BUCKET = "receipts";

export function receiptExtension(type: string): string {
  if (type === "image/jpeg") return "jpg";
  const sub = type.startsWith("image/") ? type.slice(6).replace(/[^a-z0-9]/gi, "").toLowerCase() : "";
  return sub || "jpg";
}

/** Storage policies key on the first folder, so every path starts with the household id. */
export function receiptPath(householdId: string, transactionId: string, id: string, type: string): string {
  return `${householdId}/${transactionId}/${id}.${receiptExtension(type)}`;
}

/** The newest receipt on an expense: a replace that could not remove the old copy leaves two. */
export function latestReceipt(receipts?: Receipt[] | null): Receipt | null {
  if (!receipts?.length) return null;
  return receipts.reduce((best, r) => (Date.parse(r.created_at) > Date.parse(best.created_at) ? r : best));
}

/**
 * Uploads a photo to a fresh path (never overwrites, so it needs no storage UPDATE policy) and
 * links it to the expense. If the link fails, the uploaded file is removed again.
 */
export async function attachReceipt(
  supabase: SupabaseClient,
  householdId: string,
  transactionId: string,
  file: File,
): Promise<void> {
  const path = receiptPath(householdId, transactionId, crypto.randomUUID(), file.type);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (uploadError) throw uploadError;
  const { error: rowError } = await supabase.from("receipts").insert({
    household_id: householdId,
    transaction_id: transactionId,
    storage_path: path,
    file_name: file.name || `receipt.${receiptExtension(file.type)}`,
  });
  if (rowError) {
    try {
      await supabase.storage.from(BUCKET).remove([path]);
    } catch {
      /* best effort: the row error below is what the user needs to hear about */
    }
    throw rowError;
  }
}

/**
 * Deletes the stored photos first, then their rows, so a failure part-way leaves a row the user
 * can still see and remove again rather than a photo nobody can reach.
 */
export async function deleteReceipts(supabase: SupabaseClient, receipts: Receipt[]): Promise<void> {
  if (!receipts.length) return;
  const { error: storageError } = await supabase.storage.from(BUCKET).remove(receipts.map((r) => r.storage_path));
  if (storageError) throw storageError;
  const ids = receipts.map((r) => r.id);
  const { error } = await supabase.from("receipts").delete().in("id", ids);
  if (error) throw error;
}

export type ReplaceResult = { oldRemoved: boolean };

/** Adds the new photo first; the old ones are only removed once the new one is safely linked. */
export async function replaceReceipt(
  supabase: SupabaseClient,
  householdId: string,
  transactionId: string,
  file: File,
  old: Receipt[],
): Promise<ReplaceResult> {
  await attachReceipt(supabase, householdId, transactionId, file);
  try {
    await deleteReceipts(supabase, old);
    return { oldRemoved: true };
  } catch {
    return { oldRemoved: false };
  }
}
