"use client";

import Link from "next/link";
import { Banknote, BookOpen, ChevronRight, Download, HelpCircle, Store, Tag, UserRound, WalletCards } from "lucide-react";
import { IconWell, ScreenTitle } from "@/components/ui";
import type { LucideIcon } from "lucide-react";

const SECTIONS: { title: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    title: "Household",
    items: [
      { href: "/more/categories", label: "Categories", icon: Tag },
      { href: "/more/payment-methods", label: "Payment methods", icon: WalletCards },
      { href: "/more/merchants", label: "Merchants", icon: Store },
      { href: "/more/budgets", label: "Budgets", icon: Banknote },
    ],
  },
  {
    title: "Data",
    items: [{ href: "/more/export", label: "Export data", icon: Download }],
  },
  {
    title: "App",
    items: [
      { href: "/more/settings", label: "Profile", icon: UserRound },
      { href: "/more/help", label: "Help & support", icon: HelpCircle },
      { href: "/more/about", label: "About", icon: BookOpen },
    ],
  },
];

export default function MorePage() {
  return (
    <div className="space-y-5">
      <ScreenTitle title="More" />
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 className="mb-2 text-[13px] font-medium text-muted">{section.title}</h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="press flex min-h-14 items-center justify-between gap-3 border-b border-line px-3 last:border-0"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <IconWell icon={item.icon} className="size-9" />
                  <span className="text-[16px]">{item.label}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
