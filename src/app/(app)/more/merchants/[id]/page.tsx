"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { TransactionRow } from "@/components/TransactionRow";
import { Card, PrimaryButton } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { listTransactions } from "@/lib/transactions";
import type { Merchant, Transaction } from "@/lib/types";

export default function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { household, catalogs } = useHousehold();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    if (!household) return;
    setBusy(true);
    setError(false);
    try {
      const supabase = createClient();
      const [{ data, error: merchantError }, txs] = await Promise.all([
        supabase
          .from("merchants")
          .select("id, household_id, name, normalized_name, default_category_id, default_subcategory_id, default_channel")
          .eq("household_id", household.id)
          .eq("id", id)
          .maybeSingle(),
        listTransactions(supabase, household.id, { merchantId: id }, 0, 2000),
      ]);
      if (merchantError) throw merchantError;
      setMerchant((data as Merchant | null) ?? null);
      setRows(txs);
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

  const total = rows.reduce((acc, tx) => acc + tx.amount, 0);
  const defaultCategory = catalogs.categories.find((c) => c.id === merchant?.default_category_id);

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

  if (!merchant) {
    return (
      <EmptyState
        title="Merchant not found"
        body="This store may have been removed."
        action={
          <PrimaryButton type="button" onClick={() => router.replace("/more/merchants")}>
            Back to merchants
          </PrimaryButton>
        }
      />
    );
  }

  return (
    <div className="page-sheet space-y-4">
      <button className="min-h-11 text-[15px] font-semibold text-primary" onClick={() => router.back()}>
        Back
      </button>
      <div>
        <h1 className="text-[22px] font-semibold">{merchant.name}</h1>
        <p className="mt-1 text-[28px] font-semibold tabular-nums">{formatINR(total)}</p>
        <p className="mt-1 text-[15px] text-muted">
          {rows.length} purchase{rows.length === 1 ? "" : "s"}
        </p>
      </div>
      <Card>
        <p className="text-[13px] text-muted">Default category</p>
        <p className="mt-0.5 text-[16px]">{defaultCategory?.name ?? "Learned from your expenses"}</p>
      </Card>
      <Card>
        <h2 className="mb-1 text-[16px] font-semibold">History</h2>
        {rows.length ? (
          rows.map((tx) => <TransactionRow key={tx.id} tx={tx} showDate />)
        ) : (
          <p className="pb-4 text-[15px] text-muted">No expenses for this merchant yet.</p>
        )}
      </Card>
    </div>
  );
}
