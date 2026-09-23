import { formatMonthLabel } from "@/lib/dates";
import { formatINR } from "@/lib/money";

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
