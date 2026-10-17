"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatINR, formatINRCompact } from "@/lib/money";

const H = 176;
const PAD = { top: 14, right: 14, bottom: 24, left: 42 };

function niceTop(max: number): { top: number; step: number } {
  const raw = Math.max(max, 100) / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
  return { top: Math.ceil(Math.max(max, 100) / step) * step, step };
}

function shortMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
}

/**
 * Running spend through the month, against last month by the same day and the budget.
 * Drag (or use the arrow keys) to read any day; the legend shows that day's totals.
 */
export function SpendPaceChart({
  month,
  previousMonth,
  current,
  previous,
  daysInMonth,
  budget,
}: {
  month: string;
  previousMonth: string;
  /** Running total for each day so far, index 0 = the 1st. Empty for a month that hasn't started. */
  current: number[];
  /** Running total for every day of the previous month. */
  previous: number[];
  daysInMonth: number;
  budget?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const days = Math.max(daysInMonth, previous.length, 2);
  const peak = Math.max(current.at(-1) ?? 0, previous.at(-1) ?? 0, budget ?? 0);
  const { top, step } = niceTop(peak);
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (days - 1)) * plotW;
  const y = (v: number) => PAD.top + (1 - v / top) * plotH;
  const line = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  const today = current.length - 1;
  const shown = active ?? (today >= 0 ? today : previous.length - 1);
  const curAt = shown >= 0 && shown < current.length ? current[shown] : null;
  const prevAt = shown >= 0 ? (previous[Math.min(shown, previous.length - 1)] ?? null) : null;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const dayTicks = [1, 8, 15, 22, daysInMonth];
  const mon = shortMonth(month);
  const prevMon = shortMonth(previousMonth);

  let compare: string | null = null;
  if (curAt != null && prevAt != null && prevAt > 0) {
    const diff = Math.round(curAt - prevAt);
    compare =
      diff === 0
        ? `Same as ${prevMon} by this day`
        : `${formatINR(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than ${prevMon} by this day`;
  }

  function pick(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (days - 1));
    setActive(Math.min(days - 1, Math.max(0, i)));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = shown + (e.key === "ArrowRight" ? 1 : -1);
    setActive(Math.min(days - 1, Math.max(0, next)));
  }

  const summary = [
    curAt != null ? `${formatINR(curAt)} spent by ${shown + 1} ${mon}` : `Nothing spent yet in ${mon}`,
    prevAt != null ? `${formatINR(prevAt)} by the same day in ${prevMon}` : null,
    budget ? `budget ${formatINR(budget)}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <div className="mb-3 space-y-1">
        <p className="text-[13px] text-muted">By {shown + 1} {mon}</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-3.5 rounded-full bg-primary" aria-hidden />
            <span className="text-muted">{mon}</span>
            <span className="font-semibold tabular-nums">{curAt != null ? formatINR(curAt) : "–"}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="bg-chart-rest h-0.5 w-3.5 rounded-full" aria-hidden />
            <span className="text-muted">{prevMon}</span>
            <span className="font-semibold tabular-nums">{prevAt != null ? formatINR(prevAt) : "–"}</span>
          </li>
        </ul>
        {compare ? <p className="text-[13px] text-muted">{compare}</p> : null}
      </div>

      <div
        ref={box}
        className="rounded-md focus-visible:outline-2"
        style={{ height: H }}
        tabIndex={0}
        role="group"
        aria-label={`Spending through ${mon}. ${summary}. Use the left and right arrow keys to read other days.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {width ? (
          <svg width={width} height={H} role="img" aria-label={summary} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
                  {formatINRCompact(t)}
                </text>
              </g>
            ))}
            {dayTicks.map((d) => (
              <text key={d} x={x(d - 1)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {d}
              </text>
            ))}

            {budget ? (
              <g>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(budget)}
                  y2={y(budget)}
                  stroke="var(--muted)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <text x={width - PAD.right} y={y(budget) - 5} textAnchor="end" fontSize={11} fill="var(--muted)">
                  Budget {formatINRCompact(budget)}
                </text>
              </g>
            ) : null}

            {previous.length ? (
              <path d={line(previous)} fill="none" stroke="var(--chart-rest)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
            {current.length ? (
              <>
                <path
                  d={`${line(current)}L${x(current.length - 1)},${y(0)}L${x(0)},${y(0)}Z`}
                  fill="var(--primary)"
                  opacity={0.1}
                />
                <path d={line(current)} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </>
            ) : null}

            {active != null ? (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth={1} />
            ) : null}
            {prevAt != null && active != null ? (
              <circle cx={x(Math.min(shown, previous.length - 1))} cy={y(prevAt)} r={4} fill="var(--chart-rest)" stroke="var(--surface)" strokeWidth={2} />
            ) : null}
            {curAt != null ? (
              <circle cx={x(shown)} cy={y(curAt)} r={4.5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
            ) : null}

            <rect
              x={PAD.left}
              y={PAD.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              style={{ touchAction: "pan-y" }}
              onPointerDown={pick}
              onPointerMove={(e) => {
                if (e.pointerType === "mouse" || e.buttons) pick(e);
              }}
              onPointerLeave={() => setActive(null)}
              onPointerCancel={() => setActive(null)}
            />
          </svg>
        ) : null}
      </div>
    </div>
  );
}
