"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MonthInsight } from "@/components/MonthInsight";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, ScreenTitle } from "@/components/ui";
import { formatMonthLabel, monthKey } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { fetchMonthTransactions, previousMonthTotal, spendByCategory, summarizeMonth } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import { humanMonthSummary } from "@/lib/summary";
import type { Transaction } from "@/lib/types";

function SummaryInner() {
  const params = useSearchParams();
  const month = params.get("month") || monthKey();
  const { household, catalogs } = useHousehold();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [previous, setPrevious] = useState(0);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!household) return;
    const supabase = createClient();
    setBusy(true);
    Promise.all([
      fetchMonthTransactions(supabase, household.id, month),
      previousMonthTotal(supabase, household.id, month),
    ])
      .then(([txs, prev]) => {
        setRows(txs);
        setPrevious(prev);
      })
      .finally(() => setBusy(false));
  }, [household, month]);

  const summary = summarizeMonth(rows, month);
  const categories = spendByCategory(rows, catalogs.categories);
  const largest = [...rows].sort((a, b) => b.amount - a.amount)[0];
  const text = humanMonthSummary({
    month,
    total: summary.total,
    count: summary.count,
    previous,
    topCategory: categories[0]?.category.name,
    largestName: largest?.name,
    largestAmount: largest?.amount,
  });

  return (
    <div className="page-sheet space-y-4">
      <Link href={`/reports?month=${month}`} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary">
        Back
      </Link>
      <ScreenTitle title={`${formatMonthLabel(month)} summary`} />
      {busy ? (
        <div className="skeleton h-40 rounded-xl" aria-busy="true" aria-label="Loading summary" />
      ) : (
        <>
          <div>
            <p className="hero-amount">{formatINR(summary.total)}</p>
            <p className="mt-2 text-[15px] text-muted">
              {summary.count} expense{summary.count === 1 ? "" : "s"}
            </p>
            <div className="ledger-rule mt-3" aria-hidden />
          </div>
          <Card className="space-y-2 text-[16px]">
            <p>
              <span className="text-muted">Top category</span>
              <span className="mt-0.5 block">{categories[0]?.category.name ?? "—"}</span>
            </p>
            <p>
              <span className="text-muted">Largest expense</span>
              <span className="mt-0.5 block">
                {largest ? `${largest.name} · ${formatINR(largest.amount)}` : "—"}
              </span>
            </p>
            <p>
              <span className="text-muted">Previous month</span>
              <span className="mt-0.5 block tabular-nums">{formatINR(previous)}</span>
            </p>
          </Card>
          <p className="text-[16px] leading-7">{text}</p>
          <MonthInsight
            month={month}
            total={summary.total}
            previous={previous}
            count={summary.count}
            top={categories.slice(0, 3).map((row) => ({ name: row.category.name, total: row.total }))}
          />
        </>
      )}
    </div>
  );
}

export default function SummaryPage() {
  return (
    <Suspense>
      <SummaryInner />
    </Suspense>
  );
}
