"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { MonthPicker } from "@/components/MonthPicker";
import { PullRefresh } from "@/components/PullRefresh";
import { TransactionRow } from "@/components/TransactionRow";
import { PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { formatDayHeading, monthEnd, monthKey, monthStart } from "@/lib/dates";
import { formatINR } from "@/lib/money";
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
  const [allMonths, setAllMonths] = useState(false);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  // A search can cover every month; otherwise the list is the picked month (or the filter's own dates).
  const searchAll = allMonths && Boolean(debouncedQuery.trim());
  const applied = useMemo<TransactionFilters>(
    () => ({
      ...filters,
      from: filters.from || (searchAll ? undefined : monthStart(month)),
      to: filters.to || (searchAll ? undefined : monthEnd(month)),
      query: debouncedQuery,
    }),
    [filters, month, debouncedQuery, searchAll],
  );
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => key !== "query" && key !== "month" && value != null && value !== "",
  ).length;

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
    <div className="space-y-5">
      <ScreenTitle title="Transactions" subtitle={searchAll ? "Searching every month" : "Search or filter this month"} />
      <div className="flex items-center justify-between gap-3">
        <MonthPicker value={month} onChange={(next) => router.replace(`/transactions?month=${next}`)} />
        <button
          type="button"
          className="press inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-2 text-[15px] font-semibold text-primary"
          onClick={() => setOpenFilters(true)}
          aria-label={activeFilters ? `Filter, ${activeFilters} active` : "Filter"}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filter
          {activeFilters ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[12px] leading-5 text-on-primary" aria-hidden>
              {activeFilters}
            </span>
          ) : null}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Milk, Amazon…"
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
      {query.trim() ? (
        <div className="flex gap-2" role="group" aria-label="Search in">
          {[
            { all: false, label: "This month" },
            { all: true, label: "All months" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={allMonths === option.all}
              onClick={() => setAllMonths(option.all)}
              className={`press min-h-11 rounded-full px-4 text-[14px] font-semibold ${
                allMonths === option.all ? "bg-primary text-on-primary" : "bg-surface text-muted ring-1 ring-line"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading || (busy && !rows.length) ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading expenses">
          <div className="skeleton h-16 rounded-[1.25rem]" />
          <div className="skeleton h-16 rounded-[1.25rem]" />
          <div className="skeleton h-16 rounded-[1.25rem]" />
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
            <Link
              href="/add"
              className="press inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-4 text-[16px] font-semibold text-on-primary"
            >
              Add expense
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group, index) => (
            <section key={group.date}>
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <h2 className="section-label">{group.title}</h2>
                  {group.subtitle ? <p className="text-[13px] text-muted">{group.subtitle}</p> : null}
                </div>
                {/* The last day on a page may continue on the next one, so its total waits for Load more. */}
                {hasMore && index === groups.length - 1 ? null : (
                  <p className="text-[13px] text-muted">
                    <span className="sr-only">Day total </span>
                    <span className="tabular-nums text-ink">{formatINR(group.total)}</span>
                  </p>
                )}
              </div>
              <div className="rounded-[1.25rem] border border-line bg-surface px-4">
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
              disabled={loadingMore}
              onClick={async () => {
                // A ref, not state, so a fast double tap cannot append the same page twice.
                if (!household || loadingMoreRef.current) return;
                loadingMoreRef.current = true;
                setLoadingMore(true);
                try {
                  const next = await listTransactions(createClient(), household.id, applied, page + 1, 30);
                  setRows((prev) => [...prev, ...next]);
                  setPage((p) => p + 1);
                  setHasMore(next.length === 30);
                } catch {
                  /* keep the button so they can tap again */
                } finally {
                  loadingMoreRef.current = false;
                  setLoadingMore(false);
                }
              }}
            >
              {loadingMore ? "Loading…" : "Load more"}
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
  return [...map.entries()].map(([date, items]) => ({
    date,
    items,
    total: items.reduce((acc, tx) => acc + tx.amount, 0),
    ...formatDayHeading(date),
  }));
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsInner />
    </Suspense>
  );
}
