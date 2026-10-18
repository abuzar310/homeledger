"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { TransactionRow } from "@/components/TransactionRow";
import { Card, Field, PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";
import { deleteMerchant, mergeMerchants, merchantNameCheck, renameMerchant, setMerchantDefault } from "@/lib/merchants";
import { formatINR } from "@/lib/money";
import { allPages } from "@/lib/paging";
import { createClient } from "@/lib/supabase/client";
import { listTransactions } from "@/lib/transactions";
import type { Merchant, Transaction } from "@/lib/types";

const PAGE_SIZE = 30;
const selectClass = "min-h-12 w-full rounded-xl border border-line bg-surface px-3.5";

type MerchantLite = Pick<Merchant, "id" | "name" | "normalized_name">;

export default function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { household, catalogs } = useHousehold();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [others, setOthers] = useState<MerchantLite[]>([]);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({ total: 0, count: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);

  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<MerchantLite | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState("");
  const [removing, setRemoving] = useState(false);
  const [defaultNote, setDefaultNote] = useState<string | null>(null);

  async function load() {
    if (!household) return;
    setBusy(true);
    setError(false);
    try {
      const supabase = createClient();
      const [{ data, error: merchantError }, all, amounts, first] = await Promise.all([
        supabase
          .from("merchants")
          .select("id, household_id, name, normalized_name, default_category_id, default_subcategory_id, default_channel")
          .eq("household_id", household.id)
          .eq("id", id)
          .maybeSingle(),
        supabase.from("merchants").select("id, name, normalized_name").eq("household_id", household.id).order("name"),
        // Every amount, past the API's 1,000-row cap, so the total is complete.
        allPages((from, to) =>
          supabase
            .from("transactions")
            .select("amount")
            .eq("household_id", household.id)
            .eq("merchant_id", id)
            .order("id")
            .range(from, to),
        ) as Promise<{ amount: unknown }[]>,
        listTransactions(supabase, household.id, { merchantId: id }, 0, PAGE_SIZE),
      ]);
      if (merchantError) throw merchantError;
      if (all.error) throw all.error;
      setMerchant((data as Merchant | null) ?? null);
      setOthers(((all.data ?? []) as MerchantLite[]).filter((row) => row.id !== id));
      setStats({ total: amounts.reduce((acc, row) => acc + Number(row.amount), 0), count: amounts.length });
      setRows(first);
      setHasMore(first.length === PAGE_SIZE);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, id]);

  const subcategories = useMemo(
    () => catalogs.subcategories.filter((s) => s.category_id === merchant?.default_category_id),
    [catalogs.subcategories, merchant?.default_category_id],
  );
  const pickList = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    return q ? others.filter((row) => row.name.toLowerCase().includes(q)) : others;
  }, [others, pickQuery]);

  if (busy) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading merchant">
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Something went wrong."
        body="This merchant could not be loaded."
        action={<PrimaryButton onClick={() => void load()}>Try again</PrimaryButton>}
      />
    );
  }

  if (!merchant || !household) {
    return (
      <EmptyState
        title="Merchant not found"
        body="This store may have been merged or removed."
        action={
          <PrimaryButton type="button" onClick={() => router.replace("/more/merchants")}>
            Back to merchants
          </PrimaryButton>
        }
      />
    );
  }

  const householdId = household.id;
  const current = merchant;
  const check = renaming != null ? merchantNameCheck(renaming, others, current.id) : null;

  async function saveName() {
    if (renaming == null || !check || check.error || check.clash || renameBusy) return;
    setRenameBusy(true);
    setActionError(null);
    try {
      await renameMerchant(createClient(), householdId, current.id, renaming);
      setRenaming(null);
      await load();
    } catch {
      setActionError("Could not rename this merchant. Check your connection and try again.");
    } finally {
      setRenameBusy(false);
    }
  }

  async function saveDefault(categoryId: string | null, subcategoryId: string | null) {
    setDefaultNote(null);
    setActionError(null);
    try {
      await setMerchantDefault(createClient(), householdId, current.id, categoryId, subcategoryId);
      setMerchant({ ...current, default_category_id: categoryId, default_subcategory_id: categoryId ? subcategoryId : null });
      setDefaultNote(categoryId ? "Saved. New expenses here use this category." : "Saved. The category is learned from your expenses.");
    } catch {
      setActionError("Could not save the default category. Try again.");
    }
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await listTransactions(createClient(), householdId, { merchantId: current.id }, Math.ceil(rows.length / PAGE_SIZE), PAGE_SIZE);
      setRows((cur) => [...cur, ...next.filter((tx) => !cur.some((row) => row.id === tx.id))]);
      setHasMore(next.length === PAGE_SIZE);
    } catch {
      setActionError("Could not load more expenses. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="page-sheet space-y-4">
      <button className="min-h-11 text-[15px] font-semibold text-primary" onClick={() => router.back()}>
        Back
      </button>

      {renaming == null ? (
        <div>
          <h1 className="text-[22px] font-semibold">{current.name}</h1>
          <p className="mt-1 text-[28px] font-semibold tabular-nums">{formatINR(stats.total)}</p>
          <p className="mt-1 text-[15px] text-muted">
            {stats.count} purchase{stats.count === 1 ? "" : "s"}
          </p>
        </div>
      ) : (
        <Card className="space-y-3">
          <Field label="Merchant name">
            <TextInput value={renaming} onChange={(e) => setRenaming(e.target.value)} autoFocus maxLength={80} />
          </Field>
          {check?.error ? <p className="text-[15px] text-danger">{check.error}</p> : null}
          {check?.clash ? (
            <div className="space-y-2 rounded-xl bg-bg p-3">
              <p className="text-[15px]">
                <span className="font-semibold">{check.clash.name}</span> already exists.
              </p>
              <SecondaryButton
                type="button"
                className="w-full"
                onClick={() => {
                  const target = others.find((row) => row.id === check.clash!.id) ?? null;
                  setMergeTarget(target);
                }}
              >
                Merge into {check.clash.name}
              </SecondaryButton>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <SecondaryButton type="button" disabled={renameBusy} onClick={() => setRenaming(null)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={renameBusy || Boolean(check?.error) || Boolean(check?.clash)}
              onClick={() => void saveName()}
            >
              {renameBusy ? "Saving…" : "Save name"}
            </PrimaryButton>
          </div>
        </Card>
      )}

      {actionError ? (
        <p className="text-[15px] text-danger" role="alert">
          {actionError}
        </p>
      ) : null}

      <Card className="space-y-3">
        <Field label="Always file under">
          <select
            className={selectClass}
            value={current.default_category_id ?? ""}
            onChange={(e) => void saveDefault(e.target.value || null, null)}
          >
            <option value="">Learn from my expenses</option>
            {catalogs.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {current.default_category_id && subcategories.length ? (
          <Field label="Subcategory">
            <select
              className={selectClass}
              value={current.default_subcategory_id ?? ""}
              onChange={(e) => void saveDefault(current.default_category_id, e.target.value || null)}
            >
              <option value="">None</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {defaultNote ? (
          <p className="text-[14px] text-muted" role="status">
            {defaultNote}
          </p>
        ) : null}
      </Card>

      {renaming == null ? (
        <div className="grid grid-cols-2 gap-3">
          <SecondaryButton type="button" onClick={() => setRenaming(current.name)}>
            Rename
          </SecondaryButton>
          <SecondaryButton type="button" disabled={!others.length} onClick={() => setPicking(true)}>
            Merge into…
          </SecondaryButton>
        </div>
      ) : null}

      <Card>
        <h2 className="mb-1 text-[16px] font-semibold">History</h2>
        {rows.length ? (
          rows.map((tx) => <TransactionRow key={tx.id} tx={tx} showDate />)
        ) : (
          <p className="pb-4 text-[15px] text-muted">No expenses for this merchant yet.</p>
        )}
        {hasMore ? (
          <SecondaryButton type="button" className="mt-3 w-full" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? "Loading…" : "Load more"}
          </SecondaryButton>
        ) : null}
      </Card>

      <button
        type="button"
        className="min-h-12 w-full text-[15px] font-semibold text-danger"
        onClick={() => setRemoving(true)}
      >
        Remove merchant
      </button>

      <BottomSheet open={picking} title={`Merge ${current.name} into…`} onClose={() => setPicking(false)}>
        <TextInput
          value={pickQuery}
          onChange={(e) => setPickQuery(e.target.value)}
          placeholder="Search merchants"
          aria-label="Search merchants"
        />
        <ul className="mt-3 max-h-[50vh] overflow-y-auto">
          {pickList.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="press flex min-h-12 w-full items-center border-b border-line text-left text-[16px] last:border-0"
                onClick={() => {
                  setPicking(false);
                  setMergeTarget(row);
                }}
              >
                {row.name}
              </button>
            </li>
          ))}
          {!pickList.length ? <li className="py-3 text-[15px] text-muted">No merchant matches.</li> : null}
        </ul>
      </BottomSheet>

      <ConfirmDialog
        open={mergeTarget != null}
        title={`Merge into ${mergeTarget?.name ?? ""}?`}
        body={`All ${stats.count} expense${stats.count === 1 ? "" : "s"} from ${current.name} move to ${mergeTarget?.name ?? ""}, and ${current.name} is removed. Amounts and dates don't change.`}
        confirmLabel="Merge"
        busyLabel="Merging…"
        onClose={() => setMergeTarget(null)}
        onConfirm={async () => {
          if (!mergeTarget) return;
          await mergeMerchants(createClient(), householdId, current.id, mergeTarget.id);
          router.replace(`/more/merchants/${mergeTarget.id}`);
        }}
      />

      <ConfirmDialog
        open={removing}
        title={`Remove ${current.name}?`}
        body={`Its ${stats.count} expense${stats.count === 1 ? "" : "s"} stay, just without a merchant. To keep them together under another store, use Merge instead.`}
        confirmLabel="Remove"
        busyLabel="Removing…"
        danger
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          await deleteMerchant(createClient(), householdId, current.id);
          router.replace("/more/merchants");
        }}
      />
    </div>
  );
}
