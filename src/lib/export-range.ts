import { formatMonthLabel, monthEnd, monthStart, todayISO } from "@/lib/dates";

export type RangeKind = "month" | "year" | "fy" | "custom";

export const RANGE_OPTIONS: { kind: RangeKind; label: string }[] = [
  { kind: "month", label: "This month" },
  { kind: "year", label: "This year" },
  { kind: "fy", label: "Financial year" },
  { kind: "custom", label: "Custom" },
];

export type ExportRange = {
  /** First day, inclusive (YYYY-MM-DD). */
  from: string;
  /** Last day, inclusive (YYYY-MM-DD). */
  to: string;
  /** For people: "October 2026", "FY 2026-27 (1 Apr 2026 – 31 Mar 2027)". */
  label: string;
  /** For file names: "2026-10", "FY2026-27", "2026-04-01_to_2026-06-30". */
  fileTag: string;
};

export type RangeInput = {
  kind: RangeKind;
  /** YYYY-MM, used by "month". */
  month: string;
  customFrom: string;
  customTo: string;
  /** Defaults to today in India. */
  today?: string;
};

export function isISODay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Indian financial year: 1 April to 31 March. Returns the year it starts in. */
export function financialYearStart(iso: string): number {
  const year = Number(iso.slice(0, 4));
  return Number(iso.slice(5, 7)) >= 4 ? year : year - 1;
}

/** "FY2026-27" */
export function financialYearTag(start: number): string {
  return `FY${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function span(from: string, to: string): Pick<ExportRange, "label" | "fileTag"> {
  if (from === to) return { label: dayLabel(from), fileTag: from };
  return { label: `${dayLabel(from)} – ${dayLabel(to)}`, fileTag: `${from}_to_${to}` };
}

/** Turns the export screen's choice into dates, or says what is wrong with it. */
export function resolveExportRange(input: RangeInput): ExportRange | { error: string } {
  const today = input.today ?? todayISO();
  switch (input.kind) {
    case "month": {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) return { error: "Pick a month." };
      return { from: monthStart(input.month), to: monthEnd(input.month), label: formatMonthLabel(input.month), fileTag: input.month };
    }
    case "year": {
      const from = `${today.slice(0, 4)}-01-01`;
      return { from, to: today, ...span(from, today) };
    }
    case "fy": {
      const start = financialYearStart(today);
      const from = `${start}-04-01`;
      const to = `${start + 1}-03-31`;
      const tag = financialYearTag(start);
      return { from, to, label: `${tag.replace("FY", "FY ")} (${span(from, to).label})`, fileTag: tag };
    }
    case "custom": {
      const { customFrom: from, customTo: to } = input;
      if (!from || !to) return { error: "Pick a start and an end date." };
      if (!isISODay(from) || !isISODay(to)) return { error: "Pick valid dates." };
      if (from > to) return { error: "The start date is after the end date." };
      return { from, to, ...span(from, to) };
    }
  }
}
