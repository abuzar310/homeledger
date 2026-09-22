"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Menu, Plus, ReceiptText } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/add", label: "Add", icon: Plus, center: true },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/more", label: "More", icon: Menu },
];

const DESKTOP = [
  { href: "/home", label: "Home" },
  { href: "/transactions", label: "Transactions" },
  { href: "/add", label: "Add Expense" },
  { href: "/reports", label: "Reports" },
  { href: "/more/categories", label: "Categories" },
  { href: "/more/merchants", label: "Merchants" },
  { href: "/more/payment-methods", label: "Payment Methods" },
  { href: "/more/export", label: "Export" },
  { href: "/more", label: "Settings" },
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
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center rounded-xl px-3 text-[15px] ${
                  active ? "bg-green-soft font-semibold text-green-deep" : "text-ink"
                }`}
              >
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
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-sm md:hidden"
          style={{ paddingBottom: "var(--safe-bottom)" }}
        >
          <ul className="mx-auto grid h-[var(--nav-h)] max-w-lg grid-cols-5 items-end px-2">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
              const Icon = item.icon;
              if (item.center) {
                return (
                  <li key={item.href} className="flex justify-center">
                    <Link
                      href={item.href}
                      className="-mt-5 flex size-16 flex-col items-center justify-center rounded-full bg-green text-white shadow-[var(--shadow)]"
                      aria-label="Add expense"
                    >
                      <Plus className="size-7" strokeWidth={2.5} />
                    </Link>
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${
                      active ? "font-semibold text-green" : "text-muted"
                    }`}
                  >
                    <Icon className="size-5" />
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
