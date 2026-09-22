"use client";

import { CHANNELS, CHANNEL_LABELS, type PurchaseChannel } from "@/lib/types";
import type { TransactionFilters } from "@/lib/transactions";
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
  const { catalogs } = useHousehold();
  const subs = catalogs.subcategories.filter((s) => !value.categoryId || s.category_id === value.categoryId);

  return (
    <BottomSheet open={open} title="Filters" onClose={onClose}>
      <div className="space-y-4">
        <Field label="From">
          <TextInput type="date" value={value.from ?? ""} onChange={(e) => onApply({ ...value, from: e.target.value })} />
        </Field>
        <Field label="To">
          <TextInput type="date" value={value.to ?? ""} onChange={(e) => onApply({ ...value, to: e.target.value })} />
        </Field>
        <Field label="Category">
          <Select
            value={value.categoryId ?? ""}
            onChange={(e) => onApply({ ...value, categoryId: e.target.value || undefined, subcategoryId: undefined })}
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
            value={value.subcategoryId ?? ""}
            onChange={(e) => onApply({ ...value, subcategoryId: e.target.value || undefined })}
          >
            <option value="">All</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Payment method">
          <Select
            value={value.paymentMethodId ?? ""}
            onChange={(e) => onApply({ ...value, paymentMethodId: e.target.value || undefined })}
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
            value={value.channel ?? ""}
            onChange={(e) => onApply({ ...value, channel: (e.target.value || "") as PurchaseChannel | "" })}
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
              value={value.minAmount ?? ""}
              onChange={(e) => onApply({ ...value, minAmount: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label="Max amount">
            <TextInput
              inputMode="decimal"
              value={value.maxAmount ?? ""}
              onChange={(e) => onApply({ ...value, maxAmount: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <SecondaryButton
            onClick={() =>
              onApply({
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
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}
