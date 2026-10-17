"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { formatRelativeDay } from "@/lib/dates";
import { formatINR, parseAmount } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import {
  deleteRecurring,
  isValidBillDay,
  listRecurring,
  ordinal,
  saveRecurring,
  type RecurringExpense,
} from "@/lib/recurring";

export default function RecurringPage() {
  const { household, catalogs } = useHousehold();
  const [rows, setRows] = useState<RecurringExpense[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RecurringExpense | null>(null);

  async function load() {
    if (!household) return;
    setBusy(true);
    setRows(await listRecurring(createClient(), household.id));
    setBusy(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household]);

  async function add() {
    if (!household || saving) return;
    const parsed = parseAmount(amount);
    const dayNum = Number(day);
    if (!name.trim()) {
      setFormError("Enter a name for the bill.");
      return;
    }
    if (parsed == null || parsed <= 0) {
      setFormError("Enter a valid amount.");
      return;
    }
    if (!isValidBillDay(dayNum)) {
      setFormError("Pick a day from 1 to 28.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveRecurring(createClient(), household.id, {
        name,
        amount: parsed,
        dayOfMonth: dayNum,
        categoryId: categoryId || null,
      });
    } catch {
      setFormError("Could not save this bill. Check your connection and try again.");
      return;
    } finally {
      setSaving(false);
    }
    setName("");
    setAmount("");
    setDay("");
    setCategoryId("");
    await load();
  }

  return (
    <div className="space-y-4">
      <ScreenTitle title="Recurring" />
      <p className="text-[15px] text-muted">Bills that come every month. HomeLedger can remind you and help add a draft.</p>

      {busy ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading recurring bills">
          <div className="skeleton h-20 rounded-xl" />
        </div>
      ) : !rows.length ? (
        <EmptyState title="No recurring bills yet" body="Add electricity, rent, or school fees once. We will remind you." />
      ) : (
        <Card>
          <ul>
            {rows.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-[13px] text-muted">
                    {formatINR(row.amount)} · Monthly · {ordinal(row.day_of_month)}
                  </p>
                  <p className="text-[13px] text-muted">Next: {formatRelativeDay(row.next_on)}</p>
                </div>
                <button
                  type="button"
                  className="min-h-11 text-[15px] font-semibold text-danger"
                  onClick={() => setRemoving(row)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-3">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Electricity" />
        </Field>
        <Field label="Amount">
          <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1800" />
        </Field>
        <Field label="Day of month">
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            max={28}
            step={1}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            placeholder="10"
          />
          <span className="mt-1.5 block text-[13px] text-muted">1–28, so it works every month</span>
        </Field>
        <Field label="Category">
          <select
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Optional</option>
            {catalogs.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {formError ? (
          <p className="text-[15px] text-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <PrimaryButton disabled={saving} onClick={() => void add()}>
          {saving ? "Saving…" : "Save recurring"}
        </PrimaryButton>
      </Card>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this bill?"
        body="You will no longer be reminded about it. Expenses already added stay."
        confirmLabel="Remove"
        busyLabel="Removing…"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!household || !removing) return;
          await deleteRecurring(createClient(), household.id, removing.id);
          await load();
        }}
      />
    </div>
  );
}
