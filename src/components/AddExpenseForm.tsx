"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { requestReceiptRead } from "@/lib/ai-client";
import type { ReceiptDraft } from "@/lib/ai-types";
import { todayISO } from "@/lib/dates";
import { formatINR, parseAmount } from "@/lib/money";
import { enqueueOffline } from "@/lib/offline";
import { suggestCategoryLocal } from "@/lib/categorization";
import { parseSmartEntry } from "@/lib/smart-entry";
import { CHANNELS, CHANNEL_LABELS, type PurchaseChannel } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { saveExpense } from "@/lib/transactions";
import { useHousehold } from "./HouseholdProvider";
import { SaveStatus } from "./SaveStatus";
import { Field, PrimaryButton, Select, TextArea, TextInput } from "./ui";

function speechEngine() {
  const Ctor =
    typeof window === "undefined"
      ? null
      : (window as Window & { webkitSpeechRecognition?: new () => SpeechRec; SpeechRecognition?: new () => SpeechRec })
          .webkitSpeechRecognition ||
        (window as Window & { SpeechRecognition?: new () => SpeechRec }).SpeechRecognition;
  return Ctor ? new Ctor() : null;
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function AddExpenseForm() {
  const router = useRouter();
  const { household, catalogs, userId } = useHousehold();
  const [details, setDetails] = useState(false);
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
  const [scan, setScan] = useState<"idle" | "reading" | "filled" | "skipped">("idle");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedLabel, setSavedLabel] = useState<{ name: string; amount: string; category: string } | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [guessLabel, setGuessLabel] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const pickedRef = useRef(false);
  const receiptInput = useRef<HTMLInputElement>(null);

  const subs = useMemo(
    () => catalogs.subcategories.filter((s) => !categoryId || s.category_id === categoryId),
    [catalogs.subcategories, categoryId],
  );

  function applyGuess(text: string, merchant = merchantName) {
    if (pickedRef.current) return;
    const guess = suggestCategoryLocal({ name: text, merchantName: merchant }, catalogs);
    if (!guess?.categoryId) {
      setGuessLabel(null);
      return;
    }
    setCategoryId(guess.categoryId);
    setSubcategoryId(guess.subcategoryId ?? "");
    if (guess.merchantName && !merchantName) setMerchantName(guess.merchantName);
    if (guess.paymentMethodId && !paymentMethodId) setPaymentMethodId(guess.paymentMethodId);
    if (guess.purchaseChannel && !channel) setChannel(guess.purchaseChannel);
    const category = catalogs.categories.find((c) => c.id === guess.categoryId)?.name;
    const subcategory = catalogs.subcategories.find((s) => s.id === guess.subcategoryId)?.name;
    setGuessLabel(subcategory ? `${category} · ${subcategory}` : category ?? null);
  }

  function applySmartName(next: string, force = false) {
    setName(next);
    const draft = parseSmartEntry(next);
    if (draft.amount != null && (force || !amount)) setAmount(String(draft.amount));
    if (draft.merchantName && (force || !merchantName)) setMerchantName(draft.merchantName);
    if (draft.paymentHint && (force || !paymentMethodId)) {
      const pay = catalogs.paymentMethods.find((p) => p.name.toLowerCase() === draft.paymentHint!.toLowerCase());
      if (pay) setPaymentMethodId(pay.id);
    }
    const cleaned = draft.name && draft.amount != null && draft.name !== next ? draft.name : next;
    if (draft.name && draft.amount != null && draft.name !== next) setName(draft.name);
    applyGuess(cleaned, draft.merchantName || merchantName);
  }

  function listen() {
    const rec = speechEngine();
    if (!rec) {
      setError("Voice works in Chrome or the Android app. You can still type the expense.");
      return;
    }
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (event) => {
      const spoken = event.results[0]?.[0]?.transcript?.trim();
      if (spoken) {
        applySmartName(spoken, true);
        setVoiceNote(`Heard: “${spoken}”. Check it, then save.`);
        setDetails(true);
      }
    };
    rec.onerror = () => {
      setListening(false);
      setError("Could not hear that. Type the expense instead.");
    };
    rec.onend = () => setListening(false);
    setError(null);
    setListening(true);
    rec.start();
  }

  function applyDraft(draft: ReceiptDraft) {
    if (draft.name) setName(draft.name);
    if (draft.amount != null) setAmount(String(draft.amount));
    if (draft.occurredOn) setDate(draft.occurredOn);
    if (draft.merchantName) setMerchantName(draft.merchantName);
    if (draft.notes) setNotes(draft.notes);
    if (draft.categoryName) {
      const category = catalogs.categories.find(
        (row) => row.name.toLowerCase() === draft.categoryName!.toLowerCase(),
      );
      if (category) {
        setCategoryId(category.id);
        const sub = catalogs.subcategories.find(
          (row) =>
            row.category_id === category.id &&
            row.name.toLowerCase() === (draft.subcategoryName ?? "").toLowerCase(),
        );
        setSubcategoryId(sub?.id ?? "");
      }
    }
    if (draft.paymentMethodName) {
      const pay = catalogs.paymentMethods.find(
        (row) => row.name.toLowerCase() === draft.paymentMethodName!.toLowerCase(),
      );
      if (pay) setPaymentMethodId(pay.id);
    }
    if (draft.items?.length) {
      setItems(draft.items.map((item) => ({ name: item.name, amount: String(item.amount) })));
      setDetails(true);
    }
    if (!draft.categoryName) applyGuess(draft.name || name, draft.merchantName || merchantName);
    else {
      setGuessLabel(
        draft.subcategoryName ? `${draft.categoryName} · ${draft.subcategoryName}` : draft.categoryName,
      );
    }
  }

  async function onReceipt(file: File | null) {
    setReceipt(file);
    if (!file) {
      setScan("idle");
      return;
    }
    setScan("reading");
    const draft = await requestReceiptRead(file);
    if (draft) {
      applyDraft(draft);
      setScan("filled");
    } else {
      setScan("skipped");
    }
  }

  async function submit() {
    if (!household || !userId) {
      setError("Your home is still loading. Try again in a moment.");
      return;
    }
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
    const payload = {
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
    };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOffline(payload);
      setSavedLabel({
        name: name.trim(),
        amount: formatINR(parsed),
        category: "Saved on this phone. It will sync when you are online.",
      });
      setStatus("saved");
      window.setTimeout(() => router.replace("/home"), 1100);
      return;
    }
    setStatus("saving");
    try {
      const supabase = createClient();
      const saved = await saveExpense(supabase, household.id, userId, catalogs, payload);
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
      enqueueOffline(payload);
      setSavedLabel({
        name: name.trim(),
        amount: formatINR(parsed),
        category: "Saved on this phone. It will sync when you are online.",
      });
      setStatus("saved");
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
      <Field label="What did you spend on?">
        <div className="flex gap-2">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => applySmartName(e.target.value)}
            placeholder="Milk 54"
            autoFocus
          />
          <button
            type="button"
            className="press min-h-12 shrink-0 rounded-xl border border-line px-3 text-[15px] font-semibold text-primary"
            onClick={() => listen()}
            aria-label={listening ? "Listening" : "Add by voice"}
          >
            {listening ? "Listening…" : "Speak"}
          </button>
        </div>
      </Field>
      {voiceNote ? <p className="text-[15px] text-accent">{voiceNote}</p> : null}
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
            placeholder="0"
            aria-label="Amount"
            className="w-full bg-transparent text-[36px] font-semibold leading-none tracking-tight tabular-nums text-ink outline-none placeholder:text-muted"
          />
        </div>
      </label>
      {guessLabel && !changing ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3 py-3">
          <p className="text-[15px]">
            This goes in <span className="font-semibold">{guessLabel}</span>.
          </p>
          <button type="button" className="min-h-11 shrink-0 text-[15px] font-semibold text-primary" onClick={() => setChanging(true)}>
            Change
          </button>
        </div>
      ) : null}
      {changing ? (
        <Field label="Category">
          <Select
            value={categoryId}
            onChange={(e) => {
              pickedRef.current = true;
              setCategoryId(e.target.value);
              setSubcategoryId("");
              const category = catalogs.categories.find((c) => c.id === e.target.value);
              setGuessLabel(category?.name ?? null);
            }}
          >
            <option value="">Uncategorised</option>
            {catalogs.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label={date === todayISO() ? "Date · Today" : "Date"}>
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <input
        ref={receiptInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => void onReceipt(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className="min-h-11 text-[15px] font-semibold text-primary"
        onClick={() => receiptInput.current?.click()}
      >
        Scan receipt
      </button>
      {scan === "reading" ? <p className="text-[15px] text-muted">Reading the receipt…</p> : null}
      {scan === "filled" ? (
        <div className="rounded-2xl border border-line bg-surface p-4 text-[15px]">
          <p className="font-semibold">Check the receipt</p>
          <p className="mt-2">
            {name || "Expense"} · {amount ? formatINR(Number(amount) || 0) : "—"}
          </p>
          {items.length ? (
            <ul className="mt-2 space-y-1">
              {items.map((item, i) => (
                <li key={i} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="tabular-nums">{item.amount}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-accent">Nothing is saved until you tap Add expense.</p>
        </div>
      ) : null}
      {scan === "skipped" ? (
        <p className="text-[15px] text-muted">Could not read that photo. Enter the expense yourself.</p>
      ) : null}
      <button
        type="button"
        className="min-h-11 text-[15px] font-semibold text-primary"
        onClick={() => setDetails((open) => !open)}
      >
        {details ? "Hide details" : "Add details"}
      </button>

      {details ? (
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
              capture="environment"
              className="block w-full text-[15px]"
              onChange={(e) => void onReceipt(e.target.files?.[0] ?? null)}
            />
          </Field>
          {scan === "reading" ? <p className="text-[15px] text-muted">Reading the receipt…</p> : null}
          {scan === "filled" ? (
            <p className="text-[15px] text-accent">Filled from the receipt. Check it before you save.</p>
          ) : null}
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
      <PrimaryButton type="submit" disabled={status === "saving" || status === "saved" || !household || !userId}>
        {status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved" : !household ? "Loading home…" : "Add expense"}
      </PrimaryButton>
    </form>
  );
}
