import { formatWeekRange } from "@/lib/dates";
import { formatINR, formatINRCompact } from "@/lib/money";
import type { WeekDaySpend } from "@/lib/reports";

export function WeekChart({
  days,
  today,
}: {
  days: WeekDaySpend[];
  today: string;
}) {
  const peak = Math.max(1, ...days.map((d) => d.total));
  const start = days[0]?.iso;
  const end = days[days.length - 1]?.iso;
  const total = days.reduce((acc, d) => acc + d.total, 0);
  return (
    <section className="rounded-[1.25rem] border border-line bg-surface p-4">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="section-label">This week</h2>
        <p className="text-[13px] text-muted">
          {start && end ? formatWeekRange(start, end) : null}
          {total ? <span className="text-ink"> · {formatINR(total)}</span> : null}
        </p>
      </div>
      <ul className="flex h-36 items-end justify-between gap-1.5 border-b border-line">
        {days.map((day) => {
          const on = day.iso === today;
          return (
            <li
              key={day.iso}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              aria-label={`${day.label}: ${formatINR(day.total)}`}
            >
              <span className={`text-[11px] tabular-nums ${day.total ? "text-muted" : "text-transparent"}`} aria-hidden>
                {formatINRCompact(day.total)}
              </span>
              {day.total ? (
                <span
                  className={`w-full max-w-6 rounded-t-[4px] ${on ? "bg-primary" : "bg-chart-rest"}`}
                  style={{ height: `${Math.max(4, Math.round((day.total / peak) * 78))}%` }}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      <ul className="mt-1.5 flex justify-between gap-1.5" aria-hidden>
        {days.map((day) => (
          <li
            key={day.iso}
            className={`flex-1 text-center text-[11px] ${day.iso === today ? "font-semibold text-primary" : "text-muted"}`}
          >
            {day.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
