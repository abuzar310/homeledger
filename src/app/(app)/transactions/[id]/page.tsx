"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from "@/components/ui";
import { shrinkReceiptPhoto } from "@/lib/ai-client";
import { formatRelativeDay, formatTimeIST } from "@/lib/dates";
import { formatINR, parseAmount } from "@/lib/money";
import { attachReceipt, deleteReceipts, latestReceipt, replaceReceipt } from "@/lib/receipts";
import { createClient } from "@/lib/supabase/client";
import { deleteExpense, getTransaction, replaceItems, updateExpense, upsertMerchant } from "@/lib/transactions";
import { CHANNELS, CHANNEL_LABELS, type PurchaseChannel, type Transaction } from "@/lib/types";

type Draft = {
  name: string;
  amount: string;
  date: string;
  categoryId: string;
  subcategoryId: string;
  merchant: string;
  paymentMethodId: string;
  channel: string;
  notes: string;
};

function toDraft(tx: Transaction): Draft {
  return {
    name: tx.name,
    amount: String(tx.amount),
    date: tx.occurred_on,
    categoryId: tx.category_id ?? "",
    subcategoryId: tx.subcategory_id ?? "",
    merchant: tx.merchant?.name ?? "",
    paymentMethodId: tx.payment_method_id ?? "",
    channel: tx.purchase_channel ?? "",
    notes: tx.notes ?? "",
  };
}

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { household, catalogs } = useHousehold();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editing = draft != null;
  const [confirm, setConfirm] = useState(false);
  const receipt = latestReceipt(tx?.receipts);
  const receiptPath = receipt?.storage_path ?? null;
  const [signed, setSigned] = useState<{ path: string; url: string | null } | null>(null);
  const receiptInput = useRef<HTMLInputElement>(null);
  const [receiptBusy, setReceiptBusy] = useState<"adding" | "replacing" | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptNote, setReceiptNote] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!household) return;
    setMissing(false);
    getTransaction(createClient(), id, household.id)
      .then((row) => {
        setTx(row);
        setMissing(!row);
      })
      .catch(() => setMissing(true));
  }, [id, household]);

  useEffect(() => {
    if (!receiptPath) return;
    let live = true;
    createClient()
      .storage.from("receipts")
      .createSignedUrl(receiptPath, 3600)
      .then(
        ({ data }) => {
          if (live) setSigned({ path: receiptPath, url: data?.signedUrl ?? null });
        },
        () => {
          if (live) setSigned({ path: receiptPath, url: null });
        },
      );
    return () => {
      live = false;
    };
  }, [receiptPath]);
  // undefined while the link for the current photo is still loading, null if it failed.
  const receiptUrl = signed && signed.path === receiptPath ? signed.url : undefined;

  if (missing) {
    return (
      <div className="space-y-3">
        <button className="min-h-11 text-[15px] font-semibold text-primary" onClick={() => router.back()}>
          Back
        </button>
        <h1 className="text-[22px] font-semibold">Expense not found</h1>
        <p className="text-[15px] text-muted">It may have been deleted, or it belongs to another home.</p>
      </div>
    );
  }

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

  function edit(patch: Partial<Draft>) {
    setDraft((cur) => (cur ? { ...cur, ...patch } : cur));
  }

  async function saveDraft() {
    if (!draft || !household || !tx || saving) return;
    const amount = parseAmount(draft.amount);
    if (!draft.name.trim()) return setSaveError("Enter what this expense was for.");
    if (amount == null || amount <= 0) return setSaveError("Enter a valid amount.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return setSaveError("Pick a date.");
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      // Send only what changed, so an untouched category keeps its "Needs review" state.
      const patch: Parameters<typeof updateExpense>[2] = {};
      if (draft.name.trim() !== tx.name) patch.name = draft.name.trim();
      if (amount !== tx.amount) patch.amount = amount;
      if (draft.date !== tx.occurred_on) patch.occurred_on = draft.date;
      if ((draft.categoryId || null) !== tx.category_id) patch.category_id = draft.categoryId || null;
      if ((draft.subcategoryId || null) !== tx.subcategory_id) patch.subcategory_id = draft.subcategoryId || null;
      if ((draft.paymentMethodId || null) !== tx.payment_method_id) patch.payment_method_id = draft.paymentMethodId || null;
      if ((draft.channel || null) !== tx.purchase_channel) patch.purchase_channel = (draft.channel || null) as PurchaseChannel | null;
      if ((draft.notes.trim() || null) !== (tx.notes || null)) patch.notes = draft.notes.trim() || null;
      const merchant = draft.merchant.trim();
      if (merchant !== (tx.merchant?.name ?? "")) {
        patch.merchant_id = merchant ? await upsertMerchant(supabase, household.id, merchant) : null;
      }
      if (Object.keys(patch).length) setTx(await updateExpense(supabase, tx.id, patch));
      setDraft(null);
    } catch {
      setSaveError("Could not save your changes. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onReceiptPicked(input: HTMLInputElement) {
    const picked = input.files?.[0];
    input.value = ""; // so picking the same photo again still fires
    if (!picked || !household || !tx || receiptBusy) return;
    setReceiptError(null);
    setReceiptNote(null);
    if (picked.type && !picked.type.startsWith("image/")) {
      setReceiptError("Choose a photo of the receipt.");
      return;
    }
    const old = tx.receipts ?? [];
    setReceiptBusy(old.length ? "replacing" : "adding");
    const supabase = createClient();
    try {
      const file = await shrinkReceiptPhoto(picked);
      if (old.length) {
        const { oldRemoved } = await replaceReceipt(supabase, household.id, tx.id, file, old);
        if (!oldRemoved) setReceiptNote("New photo saved. The old copy couldn't be removed.");
      } else {
        await attachReceipt(supabase, household.id, tx.id, file);
      }
    } catch {
      setReceiptError("Could not save the photo. Check your connection and try again.");
      setReceiptBusy(null);
      return;
    }
    try {
      const row = await getTransaction(supabase, tx.id, household.id);
      if (row) setTx(row);
    } catch {
      setReceiptNote("Photo saved. Open this expense again to see it.");
    }
    setReceiptBusy(null);
  }

  const when = `${formatRelativeDay(tx.occurred_on)}${tx.created_at ? ` · ${formatTimeIST(tx.created_at)}` : ""}`;

  return (
    <div className="page-sheet space-y-4">
      <button className="min-h-11 text-[15px] font-semibold text-primary" onClick={() => router.back()}>
        Back
      </button>
      <div>
        <h1 className="text-[26px] font-semibold">{tx.name}</h1>
        <p className="mt-1 text-[28px] font-semibold tabular-nums">{formatINR(tx.amount)}</p>
        <p className="mt-1 text-[15px] text-muted">{when}</p>
        {tx.needs_review ? <p className="mt-2 text-[14px] font-medium text-warn">Needs review</p> : null}
      </div>

      {!editing ? (
        <Card className="space-y-3 text-[16px]">
          <Fact label="Category" value={tx.category?.name ? `${tx.category.name}${tx.subcategory ? ` → ${tx.subcategory.name}` : ""}` : "—"} />
          <Fact label="Merchant" value={tx.merchant?.name ?? "—"} />
          <Fact label="Payment" value={tx.payment_method?.name ?? "—"} />
          <Fact label="Purchase channel" value={tx.purchase_channel ? CHANNEL_LABELS[tx.purchase_channel] : "—"} />
          <Fact label="Notes" value={tx.notes || "—"} />
        </Card>
      ) : (
        <Card className="space-y-3">
          <Field label="Name">
            <TextInput value={draft.name} onChange={(e) => edit({ name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <TextInput value={draft.amount} inputMode="decimal" onChange={(e) => edit({ amount: e.target.value })} />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={draft.date} onChange={(e) => edit({ date: e.target.value })} />
            </Field>
          </div>
          <Field label="Category">
            <select
              className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
              value={draft.categoryId}
              onChange={(e) => edit({ categoryId: e.target.value, subcategoryId: "" })}
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
              value={draft.subcategoryId}
              onChange={(e) => edit({ subcategoryId: e.target.value })}
            >
              <option value="">None</option>
              {catalogs.subcategories
                .filter((sub) => !draft.categoryId || sub.category_id === draft.categoryId)
                .map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Merchant / store">
            <TextInput value={draft.merchant} onChange={(e) => edit({ merchant: e.target.value })} />
          </Field>
          <Field label="Payment method">
            <select
              className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
              value={draft.paymentMethodId}
              onChange={(e) => edit({ paymentMethodId: e.target.value })}
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
              value={draft.channel}
              onChange={(e) => edit({ channel: e.target.value })}
            >
              <option value="">None</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <TextArea value={draft.notes} onChange={(e) => edit({ notes: e.target.value })} />
          </Field>
          {saveError ? (
            <p className="text-[15px] text-danger" role="alert">
              {saveError}
            </p>
          ) : null}
        </Card>
      )}

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
      ) : editing ? (
        <SecondaryButton
          className="w-full"
          onClick={async () => {
            await replaceItems(createClient(), tx.id, [{ name: tx.name, amount: tx.amount }]);
            setTx(await getTransaction(createClient(), tx.id));
          }}
        >
          Add line items
        </SecondaryButton>
      ) : null}

      <input
        ref={receiptInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onReceiptPicked(e.currentTarget)}
      />
      {receipt ? (
        <Card>
          <h2 className="mb-2 text-[16px] font-semibold">Receipt</h2>
          {receiptUrl ? (
            <>
              <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary">
                View receipt
              </a>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptUrl} alt="Receipt" className="mt-2 max-h-80 w-full rounded-xl object-contain" />
            </>
          ) : receiptUrl === undefined ? (
            <div className="skeleton h-40 rounded-xl" aria-busy="true" aria-label="Loading receipt" />
          ) : (
            <p className="text-[15px] text-muted">Could not load the photo. Check your connection, or replace it.</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <SecondaryButton disabled={receiptBusy != null} onClick={() => receiptInput.current?.click()}>
              {receiptBusy === "replacing" ? "Replacing…" : "Replace photo"}
            </SecondaryButton>
            <SecondaryButton className="text-danger" disabled={receiptBusy != null} onClick={() => setConfirmRemove(true)}>
              Remove photo
            </SecondaryButton>
          </div>
        </Card>
      ) : (
        <SecondaryButton className="w-full" disabled={receiptBusy != null} onClick={() => receiptInput.current?.click()}>
          {receiptBusy === "adding" ? "Adding photo…" : "Add receipt photo"}
        </SecondaryButton>
      )}
      {receiptError ? (
        <p className="text-[15px] text-danger" role="alert">
          {receiptError}
        </p>
      ) : null}
      {receiptNote ? (
        <p className="text-[15px] text-muted" role="status">
          {receiptNote}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmRemove}
        title="Remove the receipt photo?"
        body="The photo is deleted from this expense. The expense itself stays."
        confirmLabel="Remove photo"
        busyLabel="Removing…"
        danger
        onClose={() => setConfirmRemove(false)}
        onConfirm={async () => {
          await deleteReceipts(createClient(), tx.receipts ?? []);
          setReceiptError(null);
          setReceiptNote(null);
          setTx((cur) => (cur ? { ...cur, receipts: [] } : cur));
        }}
      />

      {editing ? (
        <div className="grid grid-cols-2 gap-3">
          <SecondaryButton
            disabled={saving}
            onClick={() => {
              setDraft(null);
              setSaveError(null);
            }}
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton disabled={saving} onClick={() => void saveDraft()}>
            {saving ? "Saving…" : "Save changes"}
          </PrimaryButton>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <SecondaryButton onClick={() => router.push(`/add?again=${tx.id}`)}>Add again</SecondaryButton>
          <PrimaryButton onClick={() => setDraft(toDraft(tx))}>Edit expense</PrimaryButton>
        </div>
      )}
      <SecondaryButton className="w-full text-danger" onClick={() => setConfirm(true)}>
        Delete expense
      </SecondaryButton>
      <ConfirmDialog
        open={confirm}
        title="Delete this expense?"
        body="This cannot be undone."
        confirmLabel="Delete"
        busyLabel="Deleting…"
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line py-2 last:border-0">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
