import { formatINR } from "@/lib/money";
import { budgetProgress } from "@/lib/budgets";

export function BudgetProgress({
  spent,
  limit,
  label,
}: {
  spent: number;
  limit: number;
  label?: string;
}) {
  const { percent, remaining, over } = budgetProgress(spent, limit);
  return (
    <section>
      {label ? <p className="section-label">{label}</p> : null}
      <p className="mt-1 text-[16px] font-medium tabular-nums">
        {formatINR(spent)} / {formatINR(limit)}
      </p>
      <p className="mt-0.5 text-[13px] text-muted">{percent}% used</p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${percent}% of budget used`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${over ? "bg-danger" : "bg-primary"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className={`mt-2 text-[14px] ${over ? "text-danger" : "text-muted"}`}>
        {over ? "Over budget" : `${formatINR(remaining)} remaining`}
      </p>
    </section>
  );
}
