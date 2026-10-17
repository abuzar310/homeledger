import { parseAmount } from "@/lib/money";

export type BankSms =
  | { kind: "debit"; amount: number; payee: string | null; occurredOn: string | null; paymentHint: string | null }
  | { kind: "credit" };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const AMOUNT = String.raw`([\d,]+(?:\.\d{1,2})?)`;

// Who the money went to, most specific pattern first. Each captures the payee.
const PAYEE_PATTERNS = [
  /\btrf\s+to\s+(.{2,40}?)\s+ref/i, // SBI: "trf to SWIGGY Refno"
  /;\s*([A-Za-z0-9 &.'-]{2,40}?)\s+credited/i, // ICICI: "; AMAZON PAY credited"
  /info[-:\s]+upi\/[^/]+\/[^/]+\/([^/.\n]+)/i, // Axis: "Info- UPI/P2M/123/ZOMATO"
  /\bpaid\s+(?:₹|rs\.?|inr)?\s*[\d,.]+\s+to\s+([A-Za-z][A-Za-z0-9 .&'-]{1,40}?)(?:\s+(?:on|via|using|ref|upi)\b|[.\n]|$)/i,
  /\bto\s+vpa\s+([\w.-]+@[\w.-]+)/i,
  /\bto[:\s]+([A-Za-z][A-Za-z0-9 &.'-]{1,40}?)(?:\s+(?:on|ref|upi|via|using|at)\b|[.;\n]|$)/i, // HDFC: "To NANDINI MILK\nOn"
  /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.'*-]{1,40}?)(?:\s+on\b|[.;:\n]|$)/i, // cards: "at AMAZON on"
];

/** True when pasted text reads like a bank or UPI alert rather than a typed expense. */
export function looksLikeBankSms(text: string): boolean {
  const hasAmount = /(?:₹|\brs\.?|\binr\b)\s*[\d,]/i.test(text) || /\bdebited\s+(?:by|for|with)\s+[\d,]/i.test(text);
  const hasBankWords = /\b(?:debited|credited|spent|sent|paid|txn|a\/c|acct|upi|card)\b/i.test(text);
  return text.length >= 25 && hasAmount && hasBankWords;
}

export function parseBankSms(raw: string): BankSms | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!looksLikeBankSms(raw)) return null;

  const debit = /\b(?:debited|spent|sent|paid|withdrawn|purchase)\b/i.test(text);
  if (!debit && /\bcredited\b/i.test(text)) return { kind: "credit" };

  const amountMatch =
    text.match(new RegExp(String.raw`(?:₹|\brs\.?|\binr)\s*${AMOUNT}`, "i")) ??
    text.match(new RegExp(String.raw`\bdebited\s+(?:by|for|with)\s+${AMOUNT}`, "i"));
  const amount = amountMatch ? parseAmount(amountMatch[1]) : null;
  if (amount == null || amount <= 0) return null;

  return {
    kind: "debit",
    amount,
    payee: payeeFrom(raw),
    occurredOn: dateFrom(text),
    paymentHint: /\b(?:upi|vpa)\b/i.test(text)
      ? "UPI"
      : /credit\s*card/i.test(text)
        ? "Credit Card"
        : /debit\s*card/i.test(text)
          ? "Debit Card"
          : null,
  };
}

function payeeFrom(raw: string): string | null {
  for (const re of PAYEE_PATTERNS) {
    const hit = raw.match(re)?.[1]?.trim();
    if (!hit) continue;
    const name = hit.includes("@") ? hit.split("@")[0].replace(/[\d._-]+/g, " ").trim() : hit;
    if (/^(?:your|a\/c|ac|acct|account|you)\b/i.test(name) || !/[a-z]/i.test(name)) continue;
    return titleCase(name);
  }
  return null;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function iso(year: number, month: number, day: number): string | null {
  const y = year < 100 ? 2000 + year : year;
  const d = new Date(Date.UTC(y, month - 1, day));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

function dateFrom(text: string): string | null {
  let m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));
  m = text.match(/\b(\d{1,2})[\s-]?([A-Za-z]{3})[a-z]*[\s-]?(\d{2,4})\b/);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    if (month) return iso(Number(m[3]), month, Number(m[1]));
  }
  return null;
}
