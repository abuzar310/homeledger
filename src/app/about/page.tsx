import type { Metadata } from "next";
import { PublicFacts } from "@/components/PublicFacts";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return <PublicFacts title={`About ${SITE_NAME}`} />;
}
