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
    let cancelled = false;
    requestMonthInsight({ month, total, previous, count, top }).then((next) => {
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
