"use client";

import { useState } from "react";
import { useHousehold } from "@/components/HouseholdProvider";
import { Field, PrimaryButton, ScreenTitle, SecondaryButton, TextInput } from "@/components/ui";
import { monthKey, monthStart, todayISO } from "@/lib/dates";
import { downloadBlob, transactionsToCsv, transactionsToExcelXml, transactionsToPdf } from "@/lib/export";
import { RANGE_OPTIONS, resolveExportRange, type ExportRange, type RangeKind } from "@/lib/export-range";
import { importRequestIds, parseExpenseCsv } from "@/lib/import-csv";
import { createClient } from "@/lib/supabase/client";
import { listTransactions, saveExpense } from "@/lib/transactions";
import type { Transaction } from "@/lib/types";

// Supabase returns at most 1,000 rows per request by default.
const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

type ExportKind = "csv" | "excel" | "pdf" | "backup";

export default function ExportPage() {
  const { household, catalogs, userId } = useHousehold();
  const [kind, setKind] = useState<RangeKind>("month");
  const [month, setMonth] = useState(monthKey());
  const [customFrom, setCustomFrom] = useState(() => monthStart(monthKey()));
  const [customTo, setCustomTo] = useState(() => todayISO());
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const range = resolveExportRange({ kind, month, customFrom, customTo });
  const rangeError = "error" in range ? range.error : null;

  async function load(span: ExportRange): Promise<Transaction[]> {
    if (!household) return [];
    const supabase = createClient();
    const filters = { from: span.from, to: span.to, categoryId: categoryId || undefined };
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

  async function runExport(what: ExportKind, task: (rows: Transaction[], span: ExportRange) => void) {
    if ("error" in range) {
      setError(range.error);
      return;
    }
    const span = range;
    setBusy(true);
    setExporting(what);
    setError(null);
    setImportNote(null);
    try {
      task(await load(span), span);
    } catch {
      setError("Could not export. Check your connection and try again.");
    } finally {
      setBusy(false);
      setExporting(null);
    }
  }

  return (
    <div className="space-y-4">
      <ScreenTitle title="Export / Import" />
      <div>
        <span className="mb-1.5 block text-[15px] font-medium text-muted" id="export-range-label">
          Dates
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="export-range-label">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              aria-pressed={kind === option.kind}
              disabled={busy}
              onClick={() => {
                setKind(option.kind);
                setError(null);
              }}
              className={`press min-h-11 rounded-full px-4 text-[14px] font-semibold disabled:opacity-45 ${
                kind === option.kind ? "bg-primary text-on-primary" : "bg-surface text-muted ring-1 ring-line"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {kind === "month" ? (
        <Field label="Month">
          <input
            type="month"
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3.5"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
      ) : null}
      {kind === "custom" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <TextInput type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <TextInput type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} />
          </Field>
        </div>
      ) : null}
      <p className={`text-[15px] ${rangeError ? "text-danger" : "text-muted"}`} aria-live="polite">
        {"error" in range ? range.error : `Covers ${range.label}`}
      </p>
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
          disabled={busy || rangeError != null}
          onClick={() =>
            void runExport("csv", (rows, span) =>
              downloadBlob(`homeledger-${span.fileTag}.csv`, transactionsToCsv(rows), "text/csv;charset=utf-8"),
            )
          }
        >
          {exporting === "csv" ? "Preparing CSV…" : "Export CSV"}
        </PrimaryButton>
        <SecondaryButton
          className="w-full"
          disabled={busy || rangeError != null}
          onClick={() =>
            void runExport("excel", (rows, span) =>
              downloadBlob(`homeledger-${span.fileTag}.xls`, transactionsToExcelXml(rows), "application/vnd.ms-excel"),
            )
          }
        >
          {exporting === "excel" ? "Preparing Excel…" : "Export Excel"}
        </SecondaryButton>
        <SecondaryButton
          className="w-full"
          disabled={busy || rangeError != null}
          onClick={() =>
            void runExport("pdf", (rows, span) =>
              downloadBlob(
                `homeledger-${span.fileTag}.pdf`,
                transactionsToPdf(rows, `HomeLedger ${span.label}`) as unknown as BlobPart,
                "application/pdf",
              ),
            )
          }
        >
          {exporting === "pdf" ? "Preparing PDF…" : "Export PDF"}
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
        disabled={busy || rangeError != null}
        onClick={() =>
          void runExport("backup", (rows, span) =>
            downloadBlob(
              `homeledger-backup-${span.fileTag}.json`,
              JSON.stringify(
                { version: 1, ...(kind === "month" ? { month } : {}), from: span.from, to: span.to, transactions: rows },
                null,
                2,
              ),
              "application/json",
            ),
          )
        }
      >
        {exporting === "backup" ? "Preparing backup…" : "Download backup"}
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
