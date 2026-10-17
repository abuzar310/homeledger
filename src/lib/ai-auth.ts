import { createServerSupabase } from "@/lib/supabase/server";

/** Cheap early reject before the body is read; Content-Length may be absent. */
export function bodyTooLarge(request: Request, maxBytes: number): boolean {
  const length = Number(request.headers.get("content-length"));
  return Number.isFinite(length) && length > maxBytes;
}

export async function requireAiUser() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}
