import { formatINR } from "@/lib/money";
import type { ShareRow } from "@/lib/reports";

/** One-colour share bars for a single breakdown (payment method, member…). */
export function ShareBars({ rows }: { rows: ShareRow[] }) {
  if (!rows.length) return null;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[15px]">
            <span className="min-w-0 truncate font-medium">{row.name}</span>
            <span className="shrink-0 text-[14px] text-muted">
              {row.percent}% · <span className="tabular-nums text-ink">{formatINR(row.total)}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(row.percent, 2)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
