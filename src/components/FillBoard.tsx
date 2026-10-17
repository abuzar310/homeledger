"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "./HouseholdProvider";
import { PrimaryButton } from "./ui";
import { todayISO } from "@/lib/dates";
import { FILL_TEMPLATES, resolveTemplate, templateById, type FillTemplate } from "@/lib/fill";
import { parseAmount } from "@/lib/money";
import { enqueueOffline, isNetworkError } from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";
import { saveExpense, type SaveExpenseInput } from "@/lib/transactions";

type Row = { id: string; name: string; qty: string; amount: string };

function emptyRow(): Row {
  return { id: crypto.randomUUID(), name: "", qty: "", amount: "" };
}

export function FillBoard({ chip }: { chip?: string }) {
  const router = useRouter();
  const { household, catalogs, userId } = useHousehold();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(FILL_TEMPLATES.map((t) => [t.id, [emptyRow()]])),
  );
  const [bill, setBill] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const templates = useMemo(() => {
    if (!chip) return FILL_TEMPLATES;
    const one = templateById(chip);
    return one ? [one] : FILL_TEMPLATES;
  }, [chip]);

  function update(id: string, rowId: string, patch: Partial<Row>) {
    setRows((cur) => ({
      ...cur,
      [id]: (cur[id] ?? []).map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }));
  }

  function removeRow(id: string, rowId: string) {
    setRows((cur) => {
      const left = (cur[id] ?? []).filter((row) => row.id !== rowId);
      return { ...cur, [id]: left.length ? left : [emptyRow()] };
    });
  }

  async function saveAll() {
    if (!household || !userId || status === "saving") return;
    const drafts: { template: FillTemplate; row: Row; input: SaveExpenseInput }[] = [];
    for (const template of templates) {
      for (const row of rows[template.id] ?? []) {
        const amount = parseAmount(row.amount);
        if (amount == null || amount <= 0) continue;
        const name =
          row.name.trim() ||
          (template.kind === "qty" && row.qty
            ? `${template.defaultName ?? template.label} ${row.qty}L`
            : template.defaultName || template.label);
        const resolved = resolveTemplate(catalogs, template);
        const billSub =
          template.kind === "bills" && bill ? catalogs.subcategories.find((s) => s.id === bill) : undefined;
        drafts.push({
          template,
          row,
          input: {
            name,
            amount,
            occurredOn: date,
            notes: row.qty ? `${row.qty} litre` : undefined,
            categoryId: resolved.category?.id,
            subcategoryId: billSub?.id ?? resolved.subcategory?.id,
            // The row id is stable, so a retry or a queued copy can never book the row twice.
            clientRequestId: row.id,
            userCategorized: true,
          },
        });
      }
    }
    if (!drafts.length) {
      setError("Add a name and amount first.");
      return;
    }
    setStatus("saving");
    setError(null);
    setNotice(null);
    const supabase = createClient();
    let saved = 0;
    for (const [index, draft] of drafts.entries()) {
      try {
        if (!navigator.onLine) throw new TypeError("Failed to fetch");
        await saveExpense(supabase, household.id, userId, catalogs, draft.input);
        saved += 1;
        removeRow(draft.template.id, draft.row.id);
      } catch (err) {
        const unsaved = drafts.slice(index);
        if (isNetworkError(err)) {
          for (const left of unsaved) {
            enqueueOffline(left.input, { userId, householdId: household.id });
            removeRow(left.template.id, left.row.id);
          }
          setStatus("idle");
          setNotice(
            `${unsaved.length === 1 ? "1 expense is" : `${unsaved.length} expenses are`} saved on this phone. ${
              unsaved.length === 1 ? "It" : "They"
            } will sync when you are online.`,
          );
          window.setTimeout(() => router.replace("/home"), 1600);
          return;
        }
        setStatus("error");
        setError(saved ? `${saved} saved. The rest could not be saved. Try again.` : "Could not save. Try again.");
        return;
      }
    }
    router.replace("/home?added=fill");
  }

  const billSubs = catalogs.subcategories.filter((s) => {
    const utilities = catalogs.categories.find((c) => c.name === "Utilities");
    return utilities && s.category_id === utilities.id;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Add expenses</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="search-field min-h-11 w-auto rounded-xl border border-line bg-surface px-3 text-[14px] text-ink"
          aria-label="Expense date"
        />
      </div>

      {templates.map((template) => (
        <section key={template.id} className="rounded-[1.25rem] border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">{template.label}</h2>
            <button
              type="button"
              className="press flex size-11 items-center justify-center rounded-full text-primary"
              aria-label={`Add another ${template.label} row`}
              onClick={() => setRows((cur) => ({ ...cur, [template.id]: [...(cur[template.id] ?? []), emptyRow()] }))}
            >
              <Plus className="size-5" strokeWidth={2} />
            </button>
          </div>
          {template.kind === "bills" && billSubs.length ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {billSubs.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setBill(sub.id)}
                  aria-pressed={bill === sub.id}
                  className={`press min-h-11 rounded-full px-3 py-1.5 text-[13px] ${
                    bill === sub.id ? "bg-primary text-on-primary" : "bg-bg text-muted ring-1 ring-line"
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="space-y-2">
            {(rows[template.id] ?? []).map((row) => (
              <div key={row.id} className="grid grid-cols-2 gap-2">
                {template.kind === "qty" ? (
                  <input
                    value={row.qty}
                    onChange={(e) => update(template.id, row.id, { qty: e.target.value })}
                    placeholder="Litre"
                    inputMode="decimal"
                    aria-label={`${template.label} litre`}
                    className="search-field min-h-12 rounded-xl border-0 bg-bg px-3 text-ink"
                  />
                ) : (
                  <input
                    value={row.name}
                    onChange={(e) => update(template.id, row.id, { name: e.target.value })}
                    placeholder="Name"
                    aria-label={`${template.label} name`}
                    className="search-field min-h-12 rounded-xl border-0 bg-bg px-3 text-ink"
                  />
                )}
                <input
                  value={row.amount}
                  onChange={(e) => update(template.id, row.id, { amount: e.target.value })}
                  placeholder="Amount"
                  inputMode="decimal"
                  aria-label={`${template.label} amount`}
                  className="search-field min-h-12 rounded-xl border-0 bg-bg px-3 text-ink"
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      {error ? <p className="text-[14px] text-danger">{error}</p> : null}
      {notice ? (
        <p className="text-[14px] text-accent" aria-live="polite">
          {notice}
        </p>
      ) : null}
      <PrimaryButton disabled={status === "saving" || Boolean(notice)} onClick={() => void saveAll()}>
        {status === "saving" ? "Saving…" : chip ? "Add" : "Add all"}
      </PrimaryButton>
    </div>
  );
}
