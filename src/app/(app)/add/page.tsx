"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AddExpenseForm } from "@/components/AddExpenseForm";
import { FillBoard } from "@/components/FillBoard";
import { looksLikeBankSms } from "@/lib/bank-sms";

function AddInner() {
  const params = useSearchParams();
  const chip = params.get("chip") ?? undefined;
  const again = params.get("again") ?? undefined;
  const [open, setOpen] = useState(Boolean(again));
  const [sms, setSms] = useState<{ text: string; at: number } | null>(null);
  const [smsNote, setSmsNote] = useState<string | null>(null);

  async function pasteSms() {
    setSmsNote(null);
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setOpen(true);
      setSmsNote("Paste the SMS into “What did you spend on?” below.");
      return;
    }
    if (!looksLikeBankSms(text)) {
      setSmsNote("Copy a bank or UPI SMS first, then tap Paste bank SMS.");
      return;
    }
    setSms({ text, at: Date.now() });
    setOpen(true);
  }

  return (
    <div className="page-sheet space-y-8">
      {again ? null : <FillBoard chip={chip} />}
      <div className="space-y-2">
        <button
          type="button"
          className="press min-h-11 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] font-semibold text-primary"
          onClick={() => void pasteSms()}
        >
          Paste bank SMS
        </button>
        {smsNote ? (
          <p className="text-[14px] text-muted" role="status">
            {smsNote}
          </p>
        ) : null}
      </div>
      <details
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
        className="rounded-[1.25rem] border border-line bg-surface p-4"
      >
        <summary className="cursor-pointer text-[15px] font-semibold text-ink">
          {again ? "Add again" : "More details"}
        </summary>
        <p className="mt-1 text-[13px] text-muted">
          {again ? "Same details as before, dated today." : "Voice, receipt, merchant, and notes."}
        </p>
        <div className="mt-4">
          <AddExpenseForm repeatId={again} sms={sms} />
        </div>
      </details>
    </div>
  );
}

export default function AddPage() {
  return (
    <Suspense>
      <AddInner />
    </Suspense>
  );
}
