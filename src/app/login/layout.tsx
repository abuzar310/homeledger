import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Sign in · ${SITE_NAME}`,
  description: "Sign in to HomeLedger with Google or email. Each household stays private.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
