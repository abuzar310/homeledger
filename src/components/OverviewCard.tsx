import type { CSSProperties } from "react";
import { CountUp } from "./CountUp";
import { MonthPicker } from "./MonthPicker";
import { formatINR, monthChangeCopy } from "@/lib/money";
import type { CategorySpend } from "@/lib/reports";

export function OverviewCard({
  month,
  onMonth,
  total,
  previousTotal,
  categories,
}: {
  month: string;
  onMonth: (next: string) => void;
  total: number;
  previousTotal: number;
  categories: CategorySpend[];
}) {
  const copy = monthChangeCopy(total, previousTotal);
  return (
    <section className="rounded-[1.25rem] border border-line bg-surface p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="section-label">Overview</h2>
        <MonthPicker value={month} onChange={onMonth} className="text-[15px] font-medium" />
      </div>
      {/* A total too wide to sit beside the category list moves the list onto its own line. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 grow">
          <p className="hero-amount">
            <CountUp value={total} />
          </p>
          {/* w-0 min-w-full: the line wraps to the total's width and never forces the list down itself. */}
          <p className="mt-2 w-0 min-w-full text-[13px] text-muted">{copy ?? "Spent this month"}</p>
        </div>
        {categories.length ? (
          <ul className="min-w-[9.5rem] space-y-1.5">
            {categories.slice(0, 4).map((row) => (
              <li key={row.category.id} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5 text-muted">
                  <span
                    className="cat-fill size-1.5 shrink-0 rounded-full"
                    style={(row.category.color ? { "--cat": row.category.color } : {}) as CSSProperties}
                    aria-hidden
                  />
                  <span className="truncate">{row.category.name}</span>
                </span>
                <span className="tabular-nums text-ink">{formatINR(row.total)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
