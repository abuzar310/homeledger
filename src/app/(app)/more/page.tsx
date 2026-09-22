"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ScreenTitle } from "@/components/ui";

const SECTIONS = [
  {
    title: "Household",
    items: [
      { href: "/more/categories", label: "Categories" },
      { href: "/more/payment-methods", label: "Payment methods" },
      { href: "/more/merchants", label: "Merchants" },
      { href: "/more/budgets", label: "Budgets" },
    ],
  },
  {
    title: "Data",
    items: [{ href: "/more/export", label: "Export data" }],
  },
  {
    title: "App",
    items: [
      { href: "/more/settings", label: "App settings" },
      { href: "/more/help", label: "Help & support" },
      { href: "/more/about", label: "About" },
    ],
  },
];

export default function MorePage() {
  return (
    <div className="space-y-5">
      <ScreenTitle title="More" />
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">{section.title}</h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-14 items-center justify-between border-b border-line px-4 last:border-0"
              >
                <span className="text-[16px]">{item.label}</span>
                <ChevronRight className="size-4 text-muted" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
