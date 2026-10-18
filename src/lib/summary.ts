import { formatMonthLabel, previousMonth } from "@/lib/dates";
import { formatINR, percentChange } from "@/lib/money";

export function humanMonthSummary(input: {
  month: string;
  total: number;
  count: number;
  previous: number;
  topCategory?: string;
  largestName?: string;
  largestAmount?: number;
}): string {
  const month = formatMonthLabel(input.month);
  const top = input.topCategory ? ` Most went to ${input.topCategory}.` : "";
  const largest =
    input.largestName && input.largestAmount != null
      ? ` Largest was ${input.largestName} · ${formatINR(input.largestAmount)}.`
      : "";
  const prev = ` Last month was ${formatINR(input.previous)}.`;
  return `${month}: you spent ${formatINR(input.total)} on ${input.count} expense${input.count === 1 ? "" : "s"}.${top}${largest}${prev}`;
}

export function monthName(key: string) {
  return formatMonthLabel(key).split(" ")[0];
}

/** "You spent ₹42,300 in September, 12% less than August. Most went to Groceries." */
export function lastMonthLine(input: { month: string; total: number; before: number; topCategory?: string }): string {
  const pct = percentChange(input.total, input.before);
  const versus =
    input.before > 0 && pct != null
      ? pct === 0
        ? `, the same as ${monthName(previousMonth(input.month))}`
        : `, ${Math.abs(pct)}% ${pct < 0 ? "less" : "more"} than ${monthName(previousMonth(input.month))}`
      : "";
  const top = input.topCategory ? ` Most went to ${input.topCategory}.` : "";
  return `You spent ${formatINR(input.total)} in ${monthName(input.month)}${versus}.${top}`;
}
