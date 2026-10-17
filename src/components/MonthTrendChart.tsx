"use client";

import { formatINR, formatINRCompact } from "@/lib/money";

function shortMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
}

function longMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Monthly totals as columns. The selected month is the one in colour; tap a column to open that month. */
export function MonthTrendChart({
  months,
  selected,
  onSelect,
}: {
  months: { month: string; total: number }[];
  selected: string;
  onSelect: (month: string) => void;
}) {
  const peak = Math.max(1, ...months.map((m) => m.total));
  const withSpend = months.filter((m) => m.total > 0);
  const average = withSpend.length ? withSpend.reduce((acc, m) => acc + m.total, 0) / withSpend.length : 0;

  return (
    <div>
      <p className="mb-3 text-[13px] text-muted">
        {average ? <>Average {formatINR(Math.round(average))} a month</> : "No spending in these months yet"}
      </p>
      <ul className="flex h-32 items-end justify-between gap-1.5 border-b border-line">
        {months.map((m) => {
          const on = m.month === selected;
          return (
            <li key={m.month} className="flex h-full min-w-0 flex-1">
              <button
                type="button"
                className="press flex h-full w-full flex-col items-center justify-end"
                onClick={() => onSelect(m.month)}
                aria-pressed={on}
                aria-label={`${longMonth(m.month)}: ${formatINR(m.total)}`}
              >
                {m.total ? (
                  <span
                    className={`w-full max-w-6 rounded-t-[4px] ${on ? "bg-primary" : "bg-chart-rest"}`}
                    style={{ height: `${Math.max(3, Math.round((m.total / peak) * 100))}%` }}
                    aria-hidden
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <ul className="mt-1.5 flex justify-between gap-1.5" aria-hidden>
        {months.map((m) => {
          const on = m.month === selected;
          return (
            <li key={m.month} className="min-w-0 flex-1 text-center leading-tight">
              <span className={`block text-[12px] ${on ? "font-semibold text-ink" : "text-muted"}`}>{shortMonth(m.month)}</span>
              <span className={`block text-[11px] tabular-nums ${on ? "text-ink" : "text-muted"}`}>
                {m.total ? formatINRCompact(m.total) : "–"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
