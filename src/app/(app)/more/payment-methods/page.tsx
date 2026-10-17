"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card, Field, PrimaryButton, ScreenTitle, TextInput } from "@/components/ui";
import {
  addCatalogRow,
  CATALOG_NAME_MAX,
  catalogNameError,
  cleanCatalogName,
  deleteCatalogRow,
  isOwnRow,
  nextSortOrder,
  updateCatalogRow,
} from "@/lib/catalog-edit";
import { clearCatalogCache } from "@/lib/household";
import { clearMonthCache } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMethod } from "@/lib/types";

export default function PaymentMethodsPage() {
  const { catalogs, household, refresh } = useHousehold();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The method being renamed, or null when adding. Kept while the sheet slides away.
  const [renaming, setRenaming] = useState<PaymentMethod | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState<PaymentMethod | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function openSheet(target: PaymentMethod | null) {
    setRenaming(target);
    setName(target?.name ?? "");
    setFormError(null);
    setSheetOpen(true);
  }

  /** Pickers and reports read cached catalogs and months, so drop both and load fresh ones. */
  async function reload(done: string) {
    clearCatalogCache();
    clearMonthCache();
    setNotice(null);
    try {
      await refresh();
    } catch {
      setNotice(`${done} Reopen this screen if the list looks old.`);
    }
  }

  async function save() {
    if (!household || !sheetOpen || saving) return;
    const problem = catalogNameError(name, catalogs.paymentMethods, renaming?.id);
    if (problem) {
      setFormError(problem);
      return;
    }
    const clean = cleanCatalogName(name);
    setSaving(true);
    setFormError(null);
    try {
      const supabase = createClient();
      if (renaming) {
        await updateCatalogRow(supabase, "payment_methods", household.id, renaming.id, { name: clean });
      } else {
        await addCatalogRow(supabase, "payment_methods", household.id, {
          name: clean,
          sort_order: nextSortOrder(catalogs.paymentMethods),
        });
      }
    } catch {
      setFormError("Could not save this payment method. Check your connection and try again.");
      return;
    } finally {
      setSaving(false);
    }
    setSheetOpen(false);
    await reload(renaming ? "Renamed." : `${clean} was added.`);
  }

  return (
    <div className="space-y-4">
      <ScreenTitle
        title="Payment methods"
        action={
          <button
            type="button"
            className="press min-h-11 shrink-0 rounded-xl px-2 text-[15px] font-semibold text-primary disabled:opacity-45"
            disabled={!household}
            onClick={() => openSheet(null)}
          >
            Add method
          </button>
        }
      />
      <p className="text-[15px] text-muted">Pick one when you add an expense. Add your own, like a family card, to track it too.</p>
      {notice ? (
        <p className="text-[15px] text-muted" role="status">
          {notice}
        </p>
      ) : null}
      <Card>
        <ul>
          {catalogs.paymentMethods.map((method) => (
            <li
              key={method.id}
              className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-3 last:border-0"
            >
              <span className="min-w-0 break-words">{method.name}</span>
              {isOwnRow(method, household?.id) ? (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="press min-h-11 rounded-xl px-2 text-[15px] font-semibold text-primary"
                    onClick={() => openSheet(method)}
                    aria-label={`Rename ${method.name}`}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="press min-h-11 rounded-xl px-2 text-[15px] font-semibold text-danger"
                    onClick={() => {
                      setRemoving(method);
                      setConfirmOpen(true);
                    }}
                    aria-label={`Delete ${method.name}`}
                  >
                    Delete
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <BottomSheet
        open={sheetOpen}
        title={renaming ? "Rename payment method" : "Add a payment method"}
        onClose={() => !saving && setSheetOpen(false)}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Name">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={CATALOG_NAME_MAX}
              placeholder="HDFC credit card"
              autoComplete="off"
            />
          </Field>
          {formError ? (
            <p className="text-[15px] text-danger" role="alert">
              {formError}
            </p>
          ) : null}
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Saving…" : renaming ? "Save" : "Add method"}
          </PrimaryButton>
        </form>
      </BottomSheet>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${removing?.name ?? "this payment method"}?`}
        body="Expenses paid this way stay, with no payment method. Recurring bills that used it keep going without one."
        confirmLabel="Delete"
        busyLabel="Deleting…"
        danger
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (!household || !removing) throw new Error("Payment method not ready");
          await deleteCatalogRow(createClient(), "payment_methods", household.id, removing.id);
          await reload("Deleted.");
        }}
      />
    </div>
  );
}
