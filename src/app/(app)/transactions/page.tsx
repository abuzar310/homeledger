"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { MonthPicker } from "@/components/MonthPicker";
import { PullRefresh } from "@/components/PullRefresh";
import { TransactionRow } from "@/components/TransactionRow";
import { PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { formatDayHeading, monthEnd, monthKey, monthStart } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { listTransactions, type TransactionFilters } from "@/lib/transactions";
import type { Transaction } from "@/lib/types";

const FilterSheet = dynamic(() => import("@/components/FilterSheet").then((m) => ({ default: m.FilterSheet })), {
  ssr: false,
});

function TransactionsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const month = params.get("month") || monthKey();
  const { household, catalogs, loading, refresh } = useHousehold();
  const added = params.get("added");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [openFilters, setOpenFilters] = useState(false);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);

  const applied = useMemo<TransactionFilters>(
    () => ({
      ...filters,
      from: filters.from || monthStart(month),
      to: filters.to || monthEnd(month),
      query: debouncedQuery,
    }),
    [filters, month, debouncedQuery],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!household) return;
    const supabase = createClient();
    setBusy(true);
    setError(false);
    listTransactions(supabase, household.id, applied, 0, 30)
      .then((data) => {
        setRows(data);
        setPage(0);
        setHasMore(data.length === 30);
      })
      .catch(() => setError(true))
      .finally(() => setBusy(false));
  }, [household, applied]);

  const groups = groupByDate(rows);

  return (
    <PullRefresh
      onRefresh={async () => {
        await refresh();
        if (!household) return;
        const data = await listTransactions(createClient(), household.id, applied, 0, 30);
        setRows(data);
        setPage(0);
        setHasMore(data.length === 30);
      }}
    >
    <div className="space-y-4">
      <ScreenTitle title="Transactions" />
      <div className="flex items-center justify-between">
        <MonthPicker value={month} onChange={(next) => router.replace(`/transactions?month=${next}`)} />
        <button
          className="press inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-primary"
          onClick={() => setOpenFilters(true)}
        >
          <SlidersHorizontal className="size-4" />
          Filter
        </button>
      </div>
      <div className="flex items-center gap-2">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search expenses..."
          aria-label="Search expenses"
          inputMode="search"
          enterKeyHint="search"
        />
        {query ? (
          <button type="button" className="press min-h-12 shrink-0 text-[15px] font-semibold text-primary" onClick={() => setQuery("")}>
            Clear
          </button>
        ) : null}
      </div>

      {loading || (busy && !rows.length) ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading expenses">
          <div className="skeleton h-16 rounded-2xl" />
          <div className="skeleton h-16 rounded-2xl" />
          <div className="skeleton h-16 rounded-2xl" />
        </div>
      ) : error ? (
        <EmptyState
          title="Something went wrong."
          body="Your expenses could not be loaded."
          action={
            <PrimaryButton
              type="button"
              onClick={() => {
                if (!household) return;
                setBusy(true);
                setError(false);
                listTransactions(createClient(), household.id, applied, 0, 30)
                  .then((data) => {
                    setRows(data);
                    setPage(0);
                    setHasMore(data.length === 30);
                  })
                  .catch(() => setError(true))
                  .finally(() => setBusy(false));
              }}
            >
              Try again
            </PrimaryButton>
          }
        />
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
                <h2 className="text-[13px] font-medium text-muted">{group.title}</h2>
                {group.subtitle ? <p className="text-[13px] text-muted">{group.subtitle}</p> : null}
              </div>
              <div className="rounded-2xl border border-line bg-surface px-4">
                {group.items.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    highlight={tx.id === added}
                    onDeleted={(id) => setRows((cur) => cur.filter((row) => row.id !== id))}
                  />
                ))}
              </div>
            </section>
          ))}
          {hasMore ? (
            <button
              className="min-h-12 w-full text-[15px] font-semibold text-primary"
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

      {openFilters ? (
        <FilterSheet
          open={openFilters}
          value={filters}
          onClose={() => setOpenFilters(false)}
          onApply={setFilters}
        />
      ) : null}
      <p className="sr-only">{catalogs.categories.length} categories available</p>
    </div>
    </PullRefresh>
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
