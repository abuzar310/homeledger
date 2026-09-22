import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createServerSupabase();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/home" : "/login");
}
