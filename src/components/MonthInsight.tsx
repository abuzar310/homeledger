"use client";

import { useEffect, useState } from "react";
import { requestMonthInsight } from "@/lib/ai-client";

export function MonthInsight({
  month,
  total,
  previous,
  count,
  top,
}: {
  month: string;
  total: number;
  previous: number;
  count: number;
  top: { name: string; total: number }[];
}) {
  const [text, setText] = useState<string | null>(null);
  const topKey = top.map((row) => `${row.name}:${row.total}`).join("|");

  useEffect(() => {
    // The same month with the same total and count reuses this tab's earlier note instead of asking AI again.
    const key = `hl-insight:${month}:${total}:${count}`;
    let cached: string | null = null;
    try {
      cached = sessionStorage.getItem(key);
    } catch {
      /* storage blocked: ask again */
    }
    if (cached) {
      setText(cached);
      return;
    }
    let cancelled = false;
    requestMonthInsight({ month, total, previous, count, top }).then((next) => {
      if (next) {
        try {
          sessionStorage.setItem(key, next);
        } catch {
          /* ignore quota */
        }
      }
      if (!cancelled) setText(next);
    });
    return () => {
      cancelled = true;
    };
    // ponytail: topKey is the stable stand-in for the top array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, total, previous, count, topKey]);

  if (!text) return null;
  return <p className="mt-3 text-[15px] leading-6 text-ink">{text}</p>;
}
