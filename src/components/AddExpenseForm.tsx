"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { todayISO } from "@/lib/dates";
import { formatINR, parseAmount } from "@/lib/money";
import { CHANNELS, CHANNEL_LABELS, type PurchaseChannel } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { saveExpense } from "@/lib/transactions";
import { useHousehold } from "./HouseholdProvider";
import { SaveStatus } from "./SaveStatus";
import { Field, PrimaryButton, Select, TextArea, TextInput } from "./ui";

type Mode = "quick" | "detailed";

export function AddExpenseForm() {
  const router = useRouter();
  const { household, catalogs, userId } = useHousehold();
  const [mode, setMode] = useState<Mode>("quick");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [channel, setChannel] = useState<PurchaseChannel | "">("");
  const [items, setItems] = useState<{ name: string; amount: string }[]>([]);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedLabel, setSavedLabel] = useState<{ name: string; amount: string; category: string } | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const subs = useMemo(
    () => catalogs.subcategories.filter((s) => !categoryId || s.category_id === categoryId),
    [catalogs.subcategories, categoryId],
  );

  async function submit() {
    if (!household || !userId) return;
    const parsed = parseAmount(amount);
    if (!name.trim()) {
      setError("Please enter what you spent on.");
      return;
    }
    if (parsed == null || parsed <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setError(null);
    setStatus("saving");
    try {
      const supabase = createClient();
      const saved = await saveExpense(supabase, household.id, userId, catalogs, {
        name,
        amount: parsed,
        occurredOn: date,
        notes,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        merchantName,
        paymentMethodId: paymentMethodId || null,
        purchaseChannel: channel || null,
        items: items
          .filter((item) => item.name.trim() && parseAmount(item.amount))
          .map((item) => ({ name: item.name, amount: parseAmount(item.amount)! })),
        clientRequestId: requestId,
        userCategorized: Boolean(categoryId),
      });

      if (receipt) {
        const path = `${household.id}/${saved.id}/${receipt.name}`;
        const { error: uploadError } = await supabase.storage.from("receipts").upload(path, receipt, { upsert: true });
        if (!uploadError) {
          await supabase.from("receipts").insert({
            household_id: household.id,
            transaction_id: saved.id,
            storage_path: path,
            file_name: receipt.name,
          });
        }
      }

      setSavedLabel({
        name: saved.name,
        amount: formatINR(saved.amount),
        category: saved.category?.name ?? "Organised for you",
      });
      setStatus("saved");
      window.setTimeout(() => {
        router.replace(`/home?added=${saved.id}`);
      }, 900);
    } catch {
      setStatus("error");
    }
  }

  if (savedLabel) {
    return (
      <div className="px-1 py-10 text-center">
        <span className="check-pop mx-auto flex size-12 items-center justify-center rounded-full bg-accent-soft text-xl text-accent" aria-hidden>
          ✓
        </span>
        <p className="mt-3 text-sm font-medium text-accent">Expense added</p>
        <h2 className="mt-2 text-2xl font-semibold">{savedLabel.name}</h2>
        <p className="mt-1 text-xl tabular-nums">{savedLabel.amount}</p>
        <div className="ledger-rule mx-auto mt-3" aria-hidden />
        <p className="mt-3 text-muted">{savedLabel.category}</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid grid-cols-2 rounded-xl bg-line/70 p-1">
        {(["quick", "detailed"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`min-h-11 rounded-lg text-[15px] font-semibold ${mode === id ? "bg-surface text-ink" : "text-muted"}`}
            onClick={() => setMode(id)}
          >
            {id === "quick" ? "Quick add" : "Detailed add"}
          </button>
        ))}
      </div>

      <Field label="What did you spend on?">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Milk / Amazon / Vegetables"
          autoFocus
        />
      </Field>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-medium text-ink">Amount</span>
        <div className="flex items-baseline gap-1.5 border-b-2 border-primary pb-2">
          <span className="text-2xl text-muted" aria-hidden>
            ₹
          </span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="54"
            aria-label="Amount"
            className="w-full bg-transparent text-[36px] font-semibold leading-none tracking-tight tabular-nums text-ink outline-none placeholder:text-muted"
          />
        </div>
      </label>
      <Field label="Date">
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      {mode === "detailed" ? (
        <>
          <Field label="Category">
            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId("");
              }}
            >
              <option value="">Choose later</option>
              {catalogs.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.group_name} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subcategory">
            <Select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
              <option value="">Optional</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Merchant / store">
            <TextInput value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Payment method">
            <Select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
              <option value="">Optional</option>
              {catalogs.paymentMethods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Purchase channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as PurchaseChannel | "")}>
              <option value="">Optional</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Receipt photo">
            <input
              type="file"
              accept="image/*"
              className="block w-full text-[15px]"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            />
          </Field>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[15px] font-medium">Line items</p>
              <button
                type="button"
                className="min-h-11 text-[15px] font-semibold text-primary"
                onClick={() => setItems((prev) => [...prev, { name: "", amount: "" }])}
              >
                Add item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_7rem] gap-2">
                  <TextInput
                    placeholder="Rice"
                    value={item.name}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))
                    }
                  />
                  <TextInput
                    inputMode="decimal"
                    placeholder="700"
                    value={item.amount}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, i) => (i === index ? { ...row, amount: e.target.value } : row)))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {error ? <p className="text-[15px] text-danger">{error}</p> : null}
      <SaveStatus
        state={status}
        onRetry={() => {
          setRequestId(crypto.randomUUID());
          void submit();
        }}
      />
      <PrimaryButton type="submit" disabled={status === "saving" || status === "saved"}>
        {status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved" : "Add expense"}
      </PrimaryButton>
    </form>
  );
}
