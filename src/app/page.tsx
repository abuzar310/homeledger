import { redirect } from "next/navigation";
import { PublicFacts } from "@/components/PublicFacts";
import { createServerSupabase } from "@/lib/supabase/server";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default async function RootPage() {
  const supabase = await createServerSupabase();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/home");
  }
  return <PublicFacts title="Household expenses, kept simple" />;
}
