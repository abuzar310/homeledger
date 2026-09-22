import { formatINR } from "@/lib/money";
import type { CategorySpend } from "@/lib/reports";

export function CategoryBars({
  rows,
  onSelect,
}: {
  rows: CategorySpend[];
  onSelect?: (id: string) => void;
}) {
  if (!rows.length) return null;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.category.id}>
          <button type="button" className="press min-h-11 w-full text-left" onClick={() => onSelect?.(row.category.id)}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium">{row.category.name}</span>
              <span className="text-[14px] text-muted">
                {row.percent}% · {formatINR(row.total)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(row.percent, 3)}%` }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
