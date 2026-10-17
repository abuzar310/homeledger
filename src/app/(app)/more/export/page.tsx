"use client";

import { useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Field, PrimaryButton, ScreenTitle, SecondaryButton } from "@/components/ui";
import { formatMonthLabel, monthEnd, monthKey, monthStart } from "@/lib/dates";
import { downloadBlob, transactionsToCsv, transactionsToExcelXml, transactionsToPdf } from "@/lib/export";
import { importRequestIds, parseExpenseCsv } from "@/lib/import-csv";
import { createClient } from "@/lib/supabase/client";
import { listTransactions, saveExpense } from "@/lib/transactions";
import type { Transaction } from "@/lib/types";

// Supabase returns at most 1,000 rows per request by default.
const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

export default function ExportPage() {
  const { household, catalogs, userId } = useHousehold();
  const [month, setMonth] = useState(monthKey());
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<Transaction[]> {
    if (!household) return [];
    const supabase = createClient();
    const filters = { from: monthStart(month), to: monthEnd(month), categoryId: categoryId || undefined };
    const seen = new Set<string>();
    const all: Transaction[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const rows = await listTransactions(supabase, household.id, filters, page, PAGE_SIZE);
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        all.push(row);
      }
      if (rows.length < PAGE_SIZE) break;
    }
    return all;
  }

  async function runExport(task: (rows: Transaction[]) => void) {
    setBusy(true);
    setError(null);
    setImportNote(null);
    try {
      task(await load());
    } catch {
      setError("Could not export. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
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
          onClick={() =>
            void runExport((rows) =>
              downloadBlob(`homeledger-${month}.csv`, transactionsToCsv(rows), "text/csv;charset=utf-8"),
            )
          }
        >
          Export CSV
        </PrimaryButton>
        <SecondaryButton
          className="w-full"
          disabled={busy}
          onClick={() =>
            void runExport((rows) =>
              downloadBlob(`homeledger-${month}.xls`, transactionsToExcelXml(rows), "application/vnd.ms-excel"),
            )
          }
        >
          Export Excel
        </SecondaryButton>
        <SecondaryButton
          className="w-full"
          disabled={busy}
          onClick={() =>
            void runExport((rows) =>
              downloadBlob(
                `homeledger-${month}.pdf`,
                transactionsToPdf(rows, `HomeLedger ${formatMonthLabel(month)}`) as unknown as BlobPart,
                "application/pdf",
              ),
            )
          }
        >
          Export PDF
        </SecondaryButton>
      </div>
      <Field label="Import CSV">
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          className="block w-full text-[15px]"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !household || !userId) return;
            setBusy(true);
            setImportNote(null);
            setError(null);
            let saved = 0;
            let total = 0;
            let already = 0;
            try {
              const text = await file.text();
              const { rows, skipped } = parseExpenseCsv(text);
              total = rows.length;
              // Same file + row => same id, so a retry after a failure skips rows already saved.
              const ids = await importRequestIds(household.id, text, rows.map((row) => row.rowIndex));
              const supabase = createClient();
              const existing = new Set<string>();
              for (let i = 0; i < ids.length; i += 100) {
                const { data, error: lookupError } = await supabase
                  .from("transactions")
                  .select("client_request_id")
                  .in("client_request_id", ids.slice(i, i + 100));
                if (lookupError) break; // saveExpense still dedupes; only the counts get less precise
                for (const hit of data ?? []) existing.add(hit.client_request_id as string);
              }
              for (const [i, row] of rows.entries()) {
                if (existing.has(ids[i])) {
                  already += 1;
                  continue;
                }
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
                await saveExpense(supabase, household.id, userId, catalogs, {
                  name: row.name,
                  amount: row.amount,
                  occurredOn: row.occurredOn,
                  notes: row.notes,
                  categoryId: category?.id ?? null,
                  subcategoryId: subcategory?.id ?? null,
                  merchantName: row.merchantName,
                  paymentMethodId: pay?.id ?? null,
                  clientRequestId: ids[i],
                  userCategorized: Boolean(category),
                });
                saved += 1;
              }
              setImportNote(importSummary(saved, already, skipped));
            } catch {
              setError(
                saved
                  ? `Imported ${saved} of ${total - already} new rows before something went wrong. Choose the same file again to finish; rows already saved will not be added twice.`
                  : "Could not import that file. Check your connection and try again.",
              );
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
        onClick={() =>
          void runExport((rows) =>
            downloadBlob(
              `homeledger-backup-${month}.json`,
              JSON.stringify({ version: 1, month, transactions: rows }, null, 2),
              "application/json",
            ),
          )
        }
      >
        Download backup
      </SecondaryButton>
      {error ? (
        <p className="text-[15px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {importNote ? <p className="text-[15px] text-muted">{importNote}</p> : null}
    </div>
  );
}

function importSummary(saved: number, already: number, skipped: number): string {
  if (!saved && !already) return "No usable rows in that file.";
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const parts = [`Imported ${plural(saved, "expense")}.`];
  if (already) parts.push(`${plural(already, "row")} already imported, skipped.`);
  if (skipped) parts.push(`${plural(skipped, "row")} without a valid date, name or amount, skipped.`);
  return parts.join(" ");
}
