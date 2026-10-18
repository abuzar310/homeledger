"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "./ui";
import { formatMonthLabel, previousMonth } from "@/lib/dates";
import { notifyIfAllowed, readNotifyPrefs } from "@/lib/notify";
import { fetchMonthTransactions, previousMonthTotal, spendByCategory, sum } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import { lastMonthLine, monthName } from "@/lib/summary";
import type { Category } from "@/lib/types";

/**
 * In the first week of a month, last month in one line (the "Monthly summary" setting).
 * Dismissed per month on this phone; also sent as a notification once when allowed.
 */
export function LastMonthCard({ householdId, categories, today }: { householdId: string; categories: Category[]; today: string }) {
  const last = previousMonth(today.slice(0, 7));
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (Number(today.slice(8)) > 7 || !readNotifyPrefs().monthlySummary) return;
    try {
      if (localStorage.getItem(`hl-month-summary:${last}`) === "seen") return;
    } catch {
      /* storage blocked: show it */
    }
    let alive = true;
    const supabase = createClient();
    Promise.all([fetchMonthTransactions(supabase, householdId, last), previousMonthTotal(supabase, householdId, last)])
      .then(([rows, before]) => {
        if (!alive || !rows.length) return;
        const text = lastMonthLine({
          month: last,
          total: sum(rows),
          before,
          topCategory: spendByCategory(rows, categories)[0]?.category.name,
        });
        setLine(text);
        try {
          const key = `hl-month-notified:${last}`;
          if (localStorage.getItem(key) !== "1") {
            localStorage.setItem(key, "1");
            void notifyIfAllowed(`${monthName(last)} in HomeLedger`, text);
          }
        } catch {
          /* no storage: skip the notification rather than repeat it */
        }
      })
      .catch(() => {
        /* the card is a nicety; Home still works without it */
      });
    return () => {
      alive = false;
    };
  }, [householdId, last, today, categories]);

  if (!line) return null;
  return (
    <Card>
      <p className="section-label">{formatMonthLabel(last)}</p>
      <p className="mt-1 text-[16px]">{line}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <Link href={`/reports?month=${last}`} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary">
          See {monthName(last)} report
        </Link>
        <button
          type="button"
          className="min-h-11 px-2 text-[15px] font-semibold text-muted"
          onClick={() => {
            setLine(null);
            try {
              localStorage.setItem(`hl-month-summary:${last}`, "seen");
            } catch {
              /* hidden for this visit */
            }
          }}
        >
          Got it
        </button>
      </div>
    </Card>
  );
}
