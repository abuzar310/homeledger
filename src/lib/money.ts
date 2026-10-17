const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatterExact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return Number.isInteger(value) ? formatter.format(value) : formatterExact.format(value);
}

/** Short rupee label for chart axes: ₹540, ₹12K, ₹1.2L, ₹3Cr. */
export function formatINRCompact(amount: number): string {
  const value = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const sign = amount < 0 ? "-" : "";
  const short = (n: number) => String(n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
  if (value < 1000) return `${sign}₹${Math.round(value)}`;
  if (value < 99_500) return `${sign}₹${short(value / 1000)}K`;
  if (value < 99_50_000) return `${sign}₹${short(value / 1_00_000)}L`;
  return `${sign}₹${short(value / 1_00_00_000)}Cr`;
}

export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function monthChangeCopy(current: number, previous: number): string | null {
  const pct = percentChange(current, previous);
  if (pct == null) return null;
  if (pct === 0) return "Same as last month";
  if (pct < 0) return `${Math.abs(pct)}% less than last month`;
  return `${pct}% more than last month`;
}
