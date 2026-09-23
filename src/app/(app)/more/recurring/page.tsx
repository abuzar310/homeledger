"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import { formatRelativeDay } from "@/lib/dates";
import { formatINR, parseAmount } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { deleteRecurring, listRecurring, saveRecurring, type RecurringExpense } from "@/lib/recurring";

export default function RecurringPage() {
  const { household, catalogs } = useHousehold();
  const [rows, setRows] = useState<RecurringExpense[]>([]);
  const [name, setName] = useState("Electricity");
  const [amount, setAmount] = useState("1800");
  const [day, setDay] = useState("10");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(true);

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
                    {formatINR(row.amount)} · Monthly · {row.day_of_month}th
                  </p>
                  <p className="text-[13px] text-muted">Next: {formatRelativeDay(row.next_on)}</p>
                </div>
                <button
                  type="button"
                  className="min-h-11 text-[15px] font-semibold text-danger"
                  onClick={async () => {
                    if (!household) return;
                    await deleteRecurring(createClient(), household.id, row.id);
                    await load();
                  }}
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
          <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Day of month">
          <TextInput inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} placeholder="10" />
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
        <PrimaryButton
          onClick={async () => {
            if (!household) return;
            const parsed = parseAmount(amount);
            const dayNum = Number(day);
            if (!name.trim() || parsed == null || !dayNum) return;
            await saveRecurring(createClient(), household.id, {
              name,
              amount: parsed,
              dayOfMonth: dayNum,
              categoryId: categoryId || null,
            });
            await load();
          }}
        >
          Save recurring
        </PrimaryButton>
      </Card>
    </div>
  );
}
