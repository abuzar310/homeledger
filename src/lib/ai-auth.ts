import { createServerSupabase } from "@/lib/supabase/server";

export async function requireAiUser() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}
