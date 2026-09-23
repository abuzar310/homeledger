"use client";

import { useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Field, PrimaryButton, ScreenTitle, SecondaryButton } from "@/components/ui";
import { formatMonthLabel, monthEnd, monthKey, monthStart } from "@/lib/dates";
import { downloadBlob, transactionsToCsv, transactionsToExcelXml, transactionsToPdf } from "@/lib/export";
import { parseExpenseCsv } from "@/lib/import-csv";
import { createClient } from "@/lib/supabase/client";
import { listTransactions, saveExpense } from "@/lib/transactions";

export default function ExportPage() {
  const { household, catalogs, userId } = useHousehold();
  const [month, setMonth] = useState(monthKey());
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

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
      <ScreenTitle title="Export / Import" />
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
      <Field label="Import CSV">
        <input
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-[15px]"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !household || !userId) return;
            setBusy(true);
            setImportNote(null);
            try {
              const rows = parseExpenseCsv(await file.text());
              let saved = 0;
              for (const row of rows) {
                const category = catalogs.categories.find(
                  (c) => c.name.toLowerCase() === row.categoryName.toLowerCase(),
                );
                const subcategory = catalogs.subcategories.find(
                  (s) =>
                    s.name.toLowerCase() === row.subcategoryName.toLowerCase() &&
                    (!category || s.category_id === category.id),
                );
                const pay = catalogs.paymentMethods.find(
                  (p) => p.name.toLowerCase() === row.paymentMethodName.toLowerCase(),
                );
                await saveExpense(createClient(), household.id, userId, catalogs, {
                  name: row.name,
                  amount: row.amount,
                  occurredOn: row.occurredOn,
                  notes: row.notes,
                  categoryId: category?.id ?? null,
                  subcategoryId: subcategory?.id ?? null,
                  merchantName: row.merchantName,
                  paymentMethodId: pay?.id ?? null,
                  clientRequestId: crypto.randomUUID(),
                  userCategorized: Boolean(category),
                });
                saved += 1;
              }
              setImportNote(saved ? `Imported ${saved} expenses.` : "No usable rows in that file.");
            } catch {
              setImportNote("Could not import that file.");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </Field>
      <SecondaryButton
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const rows = await load();
            downloadBlob(
              `homeledger-backup-${month}.json`,
              JSON.stringify({ version: 1, month, transactions: rows }, null, 2),
              "application/json",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Download backup
      </SecondaryButton>
      {importNote ? <p className="text-[15px] text-muted">{importNote}</p> : null}
    </div>
  );
}
