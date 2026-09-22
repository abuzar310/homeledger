"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { FilterSheet } from "@/components/FilterSheet";
import { useHousehold } from "@/components/HouseholdProvider";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionRow } from "@/components/TransactionRow";
import { PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { formatDayHeading, monthEnd, monthKey, monthStart } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { listTransactions, type TransactionFilters } from "@/lib/transactions";
import type { Transaction } from "@/lib/types";

function TransactionsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const month = params.get("month") || monthKey();
  const { household, catalogs } = useHousehold();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [openFilters, setOpenFilters] = useState(false);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const applied = useMemo<TransactionFilters>(
    () => ({
      ...filters,
      from: filters.from || monthStart(month),
      to: filters.to || monthEnd(month),
      query,
    }),
    [filters, month, query],
  );

  useEffect(() => {
    if (!household) return;
    const supabase = createClient();
    setBusy(true);
    listTransactions(supabase, household.id, applied, 0, 30)
      .then((data) => {
        setRows(data);
        setPage(0);
        setHasMore(data.length === 30);
      })
      .finally(() => setBusy(false));
  }, [household, applied]);

  const groups = groupByDate(rows);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Transactions" />
      <div className="flex items-center justify-between">
        <MonthPicker value={month} onChange={(next) => router.replace(`/transactions?month=${next}`)} />
        <button
          className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-green"
          onClick={() => setOpenFilters(true)}
        >
          <SlidersHorizontal className="size-4" />
          Filter
        </button>
      </div>
      <TextInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search expenses..."
        aria-label="Search expenses"
      />

      {busy && !rows.length ? (
        <p className="text-muted">Loading expenses…</p>
      ) : !rows.length ? (
        <EmptyState
          title="No expenses found."
          body="Try another search, or add a new household expense."
          action={
            <Link href="/add">
              <PrimaryButton>Add expense</PrimaryButton>
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.date}>
              <div className="mb-1">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{group.title}</h2>
                {group.subtitle ? <p className="text-[13px] text-muted">{group.subtitle}</p> : null}
              </div>
              <div className="rounded-2xl border border-line bg-surface px-4">
                {group.items.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </div>
            </section>
          ))}
          {hasMore ? (
            <button
              className="min-h-12 w-full text-[15px] font-semibold text-green"
              onClick={async () => {
                if (!household) return;
                const next = await listTransactions(createClient(), household.id, applied, page + 1, 30);
                setRows((prev) => [...prev, ...next]);
                setPage((p) => p + 1);
                setHasMore(next.length === 30);
              }}
            >
              Load more
            </button>
          ) : null}
        </div>
      )}

      <FilterSheet
        open={openFilters}
        value={filters}
        onClose={() => setOpenFilters(false)}
        onApply={setFilters}
      />
      <p className="sr-only">{catalogs.categories.length} categories available</p>
    </div>
  );
}

function groupByDate(rows: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  for (const row of rows) {
    const list = map.get(row.occurred_on) ?? [];
    list.push(row);
    map.set(row.occurred_on, list);
  }
  return [...map.entries()].map(([date, items]) => ({ date, items, ...formatDayHeading(date) }));
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsInner />
    </Suspense>
  );
}
