"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, Download, Home, Menu, Plus, ReceiptText, Settings, Store, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/add", label: "Add", icon: Plus, center: true },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/more", label: "More", icon: Menu },
];

const DESKTOP: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/add", label: "Add expense", icon: Plus },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/more/categories", label: "Categories", icon: Tag },
  { href: "/more/merchants", label: "Merchants", icon: Store },
  { href: "/more/payment-methods", label: "Payment methods", icon: CreditCard },
  { href: "/more/export", label: "Export", icon: Download },
  { href: "/more", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-bg md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface p-5 md:block">
        <p className="text-lg font-semibold">HomeLedger</p>
        <p className="mt-1 text-sm text-muted">Simple spending. A better home.</p>
        <nav className="mt-8 space-y-1">
          {DESKTOP.map((item) => {
            const active = pathname === item.href || (item.href !== "/more" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] ${
                  active ? "bg-primary-soft font-semibold text-primary-deep" : "text-ink"
                }`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-[calc(var(--nav-h)+var(--safe-bottom))] pt-[max(1rem,env(safe-area-inset-top))] md:max-w-3xl md:px-8 md:pb-10">
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden"
          style={{ paddingBottom: "var(--safe-bottom)" }}
          aria-label="Main"
        >
          <ul className="mx-auto grid h-[var(--nav-h)] max-w-lg grid-cols-5 items-end px-2">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
              const Icon = item.icon;
              if (item.center) {
                return (
                  <li key={item.href} className="flex justify-center">
                    <Link href={item.href} className="press -mt-3 flex flex-col items-center text-[11px] font-semibold text-primary">
                      <span className="flex size-14 items-center justify-center rounded-full bg-primary text-on-primary">
                        <Plus className="size-7" strokeWidth={2.5} aria-hidden />
                      </span>
                      <span className="mt-1">Add</span>
                    </Link>
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${
                      active ? "font-semibold text-primary" : "text-muted"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-5" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
