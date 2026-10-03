import { formatWeekRange } from "@/lib/dates";
import { formatINR } from "@/lib/money";
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
  return (
    <section className="rounded-[1.25rem] border border-line bg-surface p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="section-label">This week</h2>
        {start && end ? <p className="text-[13px] text-muted">{formatWeekRange(start, end)}</p> : null}
      </div>
      <div className="flex h-36 items-end justify-between gap-2">
        {days.map((day) => {
          const height = day.total ? Math.max(12, Math.round((day.total / peak) * 100)) : 6;
          const on = day.iso === today;
          return (
            <div key={day.iso} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              {day.total ? (
                <span className="max-w-full truncate text-[10px] tabular-nums text-muted">{formatINR(day.total)}</span>
              ) : (
                <span className="text-[10px] text-transparent">0</span>
              )}
              <div
                className={`w-full max-w-7 rounded-t-md ${on ? "bg-primary" : "bg-line"}`}
                style={{ height: `${height}%` }}
              />
              <span className={`text-[11px] ${on ? "font-semibold text-primary" : "text-muted"}`}>{day.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
