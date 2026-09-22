"use client";

import { useEffect, useState } from "react";
import { formatINR } from "@/lib/money";
import { categoryIcon } from "@/lib/icons";
import type { CategorySpend } from "@/lib/reports";

export function CategoryBars({
  rows,
  onSelect,
}: {
  rows: CategorySpend[];
  onSelect?: (id: string) => void;
}) {
  const [on, setOn] = useState(false);
  const sig = rows.map((r) => `${r.category.id}:${r.percent}:${r.total}`).join("|");
  useEffect(() => {
    setOn(false);
    const t = window.setTimeout(() => setOn(true), 20);
    return () => window.clearTimeout(t);
  }, [sig]);

  if (!rows.length) return null;
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const Icon = categoryIcon(row.category.name);
        const width = on ? Math.max(row.percent, 3) : 0;
        return (
          <li key={row.category.id}>
            <button type="button" className="press min-h-11 w-full text-left" onClick={() => onSelect?.(row.category.id)}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[15px] font-medium">
                  <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                  {row.category.name}
                </span>
                <span className="text-[14px] text-muted">
                  {row.percent}% · {formatINR(row.total)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line">
                <div className="bar-fill h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
