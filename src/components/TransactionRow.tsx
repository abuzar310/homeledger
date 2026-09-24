"use client";

import { memo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/money";
import { formatRelativeDay } from "@/lib/dates";
import { categoryIcon } from "@/lib/icons";
import { createClient } from "@/lib/supabase/client";
import { deleteExpense } from "@/lib/transactions";
import type { Transaction } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconWell } from "./ui";

export const TransactionRow = memo(function TransactionRow({
  tx,
  showDate = false,
  highlight = false,
  onDeleted,
}: {
  tx: Transaction;
  showDate?: boolean;
  highlight?: boolean;
  onDeleted?: (id: string) => void;
}) {
  const router = useRouter();
  const startX = useRef(0);
  const startY = useRef(0);
  const locking = useRef<"h" | "v" | null>(null);
  const [x, setX] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const meta = [
    showDate ? formatRelativeDay(tx.occurred_on) : null,
    tx.category?.name,
    tx.subcategory?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`relative overflow-hidden border-b border-line last:border-b-0 ${highlight ? "row-in highlight-row" : ""}`}>
      <div className="absolute inset-y-0 right-0 flex w-40">
        <Link
          href={`/transactions/${tx.id}`}
          className="flex flex-1 items-center justify-center bg-primary-soft text-[13px] font-semibold text-primary-deep"
        >
          Edit
        </Link>
        <button
          type="button"
          className="flex flex-1 items-center justify-center bg-danger text-[13px] font-semibold text-on-primary"
          onClick={() => setConfirm(true)}
        >
          Delete
        </button>
      </div>
      <Link
        href={`/transactions/${tx.id}`}
        className="press relative z-10 flex min-h-16 items-center justify-between gap-3 bg-surface py-3"
        style={{ transform: `translateX(-${x}px)`, transition: locking.current === "h" ? undefined : "transform 160ms var(--ease-out)" }}
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
          startY.current = e.touches[0].clientY;
          locking.current = null;
        }}
        onTouchMove={(e) => {
          const dx = startX.current - e.touches[0].clientX;
          const dy = Math.abs(e.touches[0].clientY - startY.current);
          if (!locking.current) {
            if (Math.abs(dx) < 8 && dy < 8) return;
            locking.current = Math.abs(dx) > dy ? "h" : "v";
          }
          if (locking.current !== "h") return;
          setX(Math.max(0, Math.min(160, dx)));
        }}
        onTouchEnd={() => setX((cur) => (cur > 72 ? 160 : 0))}
      >
        <IconWell icon={categoryIcon(tx.category?.name)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium text-ink">{tx.name}</p>
          <p className="truncate text-[13px] text-muted">
            {meta || "Expense"}
            {tx.needs_review ? " · Needs review" : ""}
          </p>
        </div>
        <p className="shrink-0 text-[16px] font-semibold tabular-nums">{formatINR(tx.amount)}</p>
      </Link>
      <ConfirmDialog
        open={confirm}
        title="Delete this expense?"
        body="This cannot be undone."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteExpense(createClient(), tx.id);
          setConfirm(false);
          setX(0);
          onDeleted?.(tx.id);
          router.refresh();
        }}
      />
    </div>
  );
});
