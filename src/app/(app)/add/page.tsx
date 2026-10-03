"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AddExpenseForm } from "@/components/AddExpenseForm";
import { FillBoard } from "@/components/FillBoard";

function AddInner() {
  const chip = useSearchParams().get("chip") ?? undefined;
  return (
    <div className="page-sheet space-y-8">
      <FillBoard chip={chip} />
      <details className="rounded-[1.25rem] border border-line bg-surface p-4">
        <summary className="cursor-pointer text-[15px] font-semibold text-ink">More details</summary>
        <p className="mt-1 text-[13px] text-muted">Voice, receipt, merchant, and notes.</p>
        <div className="mt-4">
          <AddExpenseForm />
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
