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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="hero-amount">
            <CountUp value={total} />
          </p>
          <p className="mt-2 text-[13px] text-muted">{copy ?? "Spent this month"}</p>
        </div>
        {categories.length ? (
          <ul className="min-w-[9.5rem] space-y-1.5">
            {categories.slice(0, 4).map((row) => (
              <li key={row.category.id} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5 text-muted">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: row.category.color || "var(--primary)" }}
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
