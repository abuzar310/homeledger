"use client";

import Link from "next/link";
import { Banknote, Bell, BookOpen, ChevronRight, Download, HelpCircle, Repeat, Store, Tag, UserRound, Users, WalletCards } from "lucide-react";
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
      { href: "/more/recurring", label: "Recurring", icon: Repeat },
      { href: "/more/members", label: "Household members", icon: Users },
    ],
  },
  {
    title: "Data",
    items: [{ href: "/more/export", label: "Export / Import", icon: Download }],
  },
  {
    title: "Account",
    items: [
      { href: "/more/settings", label: "Profile", icon: UserRound },
      { href: "/more/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/more/help", label: "Help & support", icon: HelpCircle },
      { href: "/more/about", label: "About", icon: BookOpen },
    ],
  },
];

export default function MorePage() {
  return (
    <div className="space-y-6">
      <ScreenTitle title="More" subtitle="Household, data, and account" />
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 className="section-label mb-2 px-1">{section.title}</h2>
          <div className="overflow-hidden rounded-[1.25rem] border border-line bg-surface">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="press flex min-h-14 items-center justify-between gap-3 border-b border-line px-3.5 last:border-0"
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
