"use client";

import { useEffect, useState } from "react";
import { CHANNELS, CHANNEL_LABELS, type PurchaseChannel } from "@/lib/types";
import type { TransactionFilters } from "@/lib/transactions";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "./HouseholdProvider";
import { BottomSheet } from "./BottomSheet";
import { Field, PrimaryButton, SecondaryButton, Select, TextInput } from "./ui";

export function FilterSheet({
  open,
  value,
  onClose,
  onApply,
}: {
  open: boolean;
  value: TransactionFilters;
  onClose: () => void;
  onApply: (next: TransactionFilters) => void;
}) {
  const { catalogs, household } = useHousehold();
  const [draft, setDraft] = useState<TransactionFilters>(value);
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const subs = catalogs.subcategories.filter((s) => !draft.categoryId || s.category_id === draft.categoryId);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open || !household) return;
    createClient()
      .from("merchants")
      .select("id, name")
      .eq("household_id", household.id)
      .order("name")
      .then(({ data }) => setMerchants((data ?? []) as { id: string; name: string }[]));
  }, [open, household]);

  return (
    <BottomSheet open={open} title="Filters" onClose={onClose}>
      <div className="flex h-[min(32rem,70vh)] flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <Field label="From">
          <TextInput type="date" value={draft.from ?? ""} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </Field>
        <Field label="To">
          <TextInput type="date" value={draft.to ?? ""} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </Field>
        <Field label="Category">
          <Select
            value={draft.categoryId ?? ""}
            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value || undefined, subcategoryId: undefined })}
          >
            <option value="">All categories</option>
            {catalogs.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subcategory">
          <Select
            value={draft.subcategoryId ?? ""}
            onChange={(e) => setDraft({ ...draft, subcategoryId: e.target.value || undefined })}
          >
            <option value="">All</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Merchant">
          <Select
            value={draft.merchantId ?? ""}
            onChange={(e) => setDraft({ ...draft, merchantId: e.target.value || undefined })}
          >
            <option value="">All</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Payment method">
          <Select
            value={draft.paymentMethodId ?? ""}
            onChange={(e) => setDraft({ ...draft, paymentMethodId: e.target.value || undefined })}
          >
            <option value="">All</option>
            {catalogs.paymentMethods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Purchase channel">
          <Select
            value={draft.channel ?? ""}
            onChange={(e) => setDraft({ ...draft, channel: (e.target.value || "") as PurchaseChannel | "" })}
          >
            <option value="">All</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min amount">
            <TextInput
              inputMode="decimal"
              value={draft.minAmount ?? ""}
              onChange={(e) => setDraft({ ...draft, minAmount: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label="Max amount">
            <TextInput
              inputMode="decimal"
              value={draft.maxAmount ?? ""}
              onChange={(e) => setDraft({ ...draft, maxAmount: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
        </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
          <SecondaryButton
            onClick={() =>
              setDraft({
                from: undefined,
                to: undefined,
                categoryId: undefined,
                subcategoryId: undefined,
                merchantId: undefined,
                paymentMethodId: undefined,
                channel: "",
                minAmount: null,
                maxAmount: null,
              })
            }
          >
            Clear
          </SecondaryButton>
          <PrimaryButton
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Apply
          </PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}
