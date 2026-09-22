"use client";

import { useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Field, PrimaryButton, ScreenTitle, SecondaryButton } from "@/components/ui";
import { formatMonthLabel, monthEnd, monthKey, monthStart } from "@/lib/dates";
import { downloadBlob, transactionsToCsv, transactionsToExcelXml, transactionsToPdf } from "@/lib/export";
import { createClient } from "@/lib/supabase/client";
import { listTransactions } from "@/lib/transactions";

export default function ExportPage() {
  const { household, catalogs } = useHousehold();
  const [month, setMonth] = useState(monthKey());
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!household) return [];
    return listTransactions(
      createClient(),
      household.id,
      { from: monthStart(month), to: monthEnd(month), categoryId: categoryId || undefined },
      0,
      2000,
    );
  }

  return (
    <div className="space-y-4">
      <ScreenTitle title="Export data" />
      <Field label="Month">
        <input
          type="month"
          className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </Field>
      <Field label="Category">
        <select
          className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">All categories</option>
          {catalogs.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="space-y-2">
        <PrimaryButton
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const rows = await load();
              downloadBlob(`homeledger-${month}.csv`, transactionsToCsv(rows), "text/csv;charset=utf-8");
            } finally {
              setBusy(false);
            }
          }}
        >
          Export CSV
        </PrimaryButton>
        <SecondaryButton
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const rows = await load();
              downloadBlob(
                `homeledger-${month}.xls`,
                transactionsToExcelXml(rows),
                "application/vnd.ms-excel",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Export Excel
        </SecondaryButton>
        <SecondaryButton
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const rows = await load();
              downloadBlob(
                `homeledger-${month}.pdf`,
                transactionsToPdf(rows, `HomeLedger ${formatMonthLabel(month)}`) as unknown as BlobPart,
                "application/pdf",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Export PDF
        </SecondaryButton>
      </div>
    </div>
  );
}
