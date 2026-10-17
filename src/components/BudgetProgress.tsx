import { AlertTriangle } from "lucide-react";
import { formatINR } from "@/lib/money";
import { budgetPace, budgetProgress } from "@/lib/budgets";
import { formatRelativeDay } from "@/lib/dates";

export function BudgetProgress({
  spent,
  limit,
  label,
  month,
  today,
}: {
  spent: number;
  limit: number;
  label?: string;
  /** Pass the month and today to show the pace tick and projection for the month in progress. */
  month?: string;
  today?: string;
}) {
  const { percent, remaining, over } = budgetProgress(spent, limit);
  const pace = month && today ? budgetPace(spent, limit, month, today) : null;
  const crossOn = pace?.crossDay && month ? `${month}-${String(pace.crossDay).padStart(2, "0")}` : null;
  const warn = !over && crossOn != null;

  return (
    <section>
      {label ? <p className="section-label">{label}</p> : null}
      <p className="mt-1 text-[16px] font-medium tabular-nums">
        {formatINR(spent)} / {formatINR(limit)}
      </p>
      <p className="mt-0.5 text-[13px] text-muted">{percent}% used</p>
      <div className="relative mt-2">
        <div
          className="h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`${percent}% of budget used`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${
              over ? "bg-danger" : warn ? "bg-warn" : "bg-primary"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {pace ? (
          <span
            className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-ink"
            style={{ left: `${pace.elapsedPercent}%` }}
            title="Where spending would be today at an even pace"
            aria-hidden
          />
        ) : null}
      </div>
      {over ? (
        <p className="mt-2 flex items-center gap-1.5 text-[14px] text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Over budget by {formatINR(spent - limit)}
        </p>
      ) : warn ? (
        <p className="mt-2 flex items-start gap-1.5 text-[14px] text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {formatINR(remaining)} left. At this pace it runs out around {formatRelativeDay(crossOn!, today)}.
          </span>
        </p>
      ) : (
        <p className="mt-2 text-[14px] text-muted">
          {formatINR(remaining)} remaining
          {pace ? ` · on pace for ${formatINR(pace.projected)}` : ""}
        </p>
      )}
    </section>
  );
}
