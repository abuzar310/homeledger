"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from "@/components/ui";
import { formatINR, parseAmount } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { deleteExpense, getTransaction, replaceItems, updateExpense, upsertMerchant } from "@/lib/transactions";
import { CHANNELS, CHANNEL_LABELS, type PurchaseChannel, type Transaction } from "@/lib/types";

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { household, catalogs } = useHousehold();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    getTransaction(createClient(), id).then(setTx);
  }, [id]);

  useEffect(() => {
    const path = tx?.receipts?.[0]?.storage_path;
    if (!path) return;
    createClient()
      .storage.from("receipts")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setReceiptUrl(data?.signedUrl ?? null));
  }, [tx]);

  if (!tx) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading expense">
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  const items = tx.items ?? [];
  const itemTotal = items.reduce((s, i) => s + i.amount, 0);

  async function savePatch(patch: Parameters<typeof updateExpense>[2]) {
    const saved = await updateExpense(createClient(), tx!.id, patch);
    setTx(saved);
  }

  return (
    <div className="space-y-4">
      <button className="min-h-11 text-[15px] font-semibold text-primary" onClick={() => router.back()}>
        Back
      </button>
      <Card>
        <p className="text-[15px] text-muted">{tx.occurred_on}</p>
        <h1 className="mt-1 text-[26px] font-semibold">{tx.name}</h1>
        <p className="mt-1 text-[28px] font-semibold tabular-nums">{formatINR(tx.amount)}</p>
        {tx.needs_review ? <p className="mt-2 text-[14px] font-medium text-warn">Needs review</p> : null}
      </Card>

      <Card className="space-y-3">
        <Field label="Name">
          <TextInput defaultValue={tx.name} onBlur={(e) => void savePatch({ name: e.target.value })} />
        </Field>
        <Field label="Amount">
          <TextInput
            defaultValue={String(tx.amount)}
            inputMode="decimal"
            onBlur={(e) => {
              const n = parseAmount(e.target.value);
              if (n != null) void savePatch({ amount: n });
            }}
          />
        </Field>
        <Field label="Category">
          <select
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
            value={tx.category_id ?? ""}
            onChange={(e) => void savePatch({ category_id: e.target.value || null, subcategory_id: null })}
          >
            <option value="">Uncategorised</option>
            {catalogs.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subcategory">
          <select
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
            value={tx.subcategory_id ?? ""}
            onChange={(e) => void savePatch({ subcategory_id: e.target.value || null })}
          >
            <option value="">None</option>
            {catalogs.subcategories
              .filter((s) => !tx.category_id || s.category_id === tx.category_id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Merchant / store">
          <TextInput
            defaultValue={tx.merchant?.name ?? ""}
            onBlur={async (e) => {
              if (!household || !e.target.value.trim()) {
                void savePatch({ merchant_id: null });
                return;
              }
              const merchantId = await upsertMerchant(createClient(), household.id, e.target.value);
              void savePatch({ merchant_id: merchantId });
            }}
          />
        </Field>
        <Field label="Payment method">
          <select
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
            value={tx.payment_method_id ?? ""}
            onChange={(e) => void savePatch({ payment_method_id: e.target.value || null })}
          >
            <option value="">None</option>
            {catalogs.paymentMethods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Purchase channel">
          <select
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
            value={tx.purchase_channel ?? ""}
            onChange={(e) => void savePatch({ purchase_channel: (e.target.value || null) as PurchaseChannel | null })}
          >
            <option value="">None</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <TextArea defaultValue={tx.notes ?? ""} onBlur={(e) => void savePatch({ notes: e.target.value || null })} />
        </Field>
      </Card>

      {items.length ? (
        <Card>
          <h2 className="mb-2 text-[16px] font-semibold">Items</h2>
          <ul>
            {items.map((item) => (
              <li key={item.id} className="flex justify-between border-b border-line py-2 last:border-0">
                <span>{item.name}</span>
                <span className="tabular-nums">{formatINR(item.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(itemTotal || tx.amount)}</span>
          </div>
        </Card>
      ) : (
        <SecondaryButton
          className="w-full"
          onClick={async () => {
            await replaceItems(createClient(), tx.id, [{ name: tx.name, amount: tx.amount }]);
            setTx(await getTransaction(createClient(), tx.id));
          }}
        >
          Add line items
        </SecondaryButton>
      )}

      {receiptUrl ? (
        <Card>
          <h2 className="mb-2 text-[16px] font-semibold">Receipt</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={receiptUrl} alt="Receipt" className="max-h-80 w-full rounded-xl object-contain" />
        </Card>
      ) : null}

      <PrimaryButton className="bg-danger" onClick={() => setConfirm(true)}>
        Delete expense
      </PrimaryButton>
      <ConfirmDialog
        open={confirm}
        title="Delete this expense?"
        body="This cannot be undone."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteExpense(createClient(), tx.id);
          router.replace("/transactions");
        }}
      />
    </div>
  );
}
