import Link from "next/link";
import { formatINR } from "@/lib/money";
import { formatRelativeDay } from "@/lib/dates";
import { categoryIcon } from "@/lib/icons";
import type { Transaction } from "@/lib/types";
import { IconWell } from "./ui";

export function TransactionRow({
  tx,
  showDate = false,
}: {
  tx: Transaction;
  showDate?: boolean;
}) {
  const meta = [showDate ? formatRelativeDay(tx.occurred_on) : null, tx.category?.name, tx.payment_method?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/transactions/${tx.id}`}
      className="press flex min-h-16 items-center justify-between gap-3 border-b border-line py-3 last:border-b-0"
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
  );
}
