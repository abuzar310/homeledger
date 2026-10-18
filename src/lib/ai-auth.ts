import { createServerSupabase } from "@/lib/supabase/server";

/** Cheap early reject before the body is read; Content-Length may be absent. */
export function bodyTooLarge(request: Request, maxBytes: number): boolean {
  const length = Number(request.headers.get("content-length"));
  return Number.isFinite(length) && length > maxBytes;
}

export const AI_LIMIT_MESSAGE = "You've used today's AI help. It comes back tomorrow; you can still type expenses.";

/**
 * Counts one AI call against the signed-in user's daily allowance (bump_ai_usage, migration 0005:
 * 200 categorise, 30 receipts, 50 insights a day). False once it's used up. If the function is
 * missing or the check fails, AI stays available rather than breaking the app.
 */
export async function withinAiQuota(route: "categorize" | "receipt" | "insight"): Promise<boolean> {
  const supabase = await createServerSupabase();
  if (!supabase) return true;
  const { data, error } = await supabase.rpc("bump_ai_usage", { p_route: route });
  if (error) return true;
  return data !== false;
}

export async function requireAiUser() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}
