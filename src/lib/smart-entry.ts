import { detectMerchantName } from "@/lib/categorization/rules";
import { parseAmount } from "@/lib/money";

export type SmartDraft = {
  name: string;
  amount: number | null;
  merchantName: string | null;
  paymentHint: string | null;
};

const PAYMENTS: { re: RegExp; name: string }[] = [
  { re: /\bupi\b/i, name: "UPI" },
  { re: /\bcash\b/i, name: "Cash" },
  { re: /\bcredit\s*card\b/i, name: "Credit Card" },
  { re: /\bdebit\s*card\b/i, name: "Debit Card" },
  { re: /\bbank\s*transfer\b/i, name: "Bank Transfer" },
];

// Indian (1,20,000) or international (120,000) grouping, else plain digits; optional paise.
const NUMBER = String.raw`(?:\d{1,3}(?:,\d{2})+,\d{3}|\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?!\d)`;
const MARKED = new RegExp(String.raw`(?:₹|rs\.?\s+)(${NUMBER})`, "i");
const NUMBERS = new RegExp(`(${NUMBER})`, "g");

// Voice in Hindi or Kannada can come back with Devanagari (०-९) or Kannada (೦-೯) digits.
function asciiDigits(value: string): string {
  return value
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[೦-೯]/g, (d) => String(d.charCodeAt(0) - 0x0ce6));
}

export function parseSmartEntry(input: string): SmartDraft {
  const raw = asciiDigits(input);
  let text = raw.trim();
  if (!text) return { name: "", amount: null, merchantName: null, paymentHint: null };

  let paymentHint: string | null = null;
  for (const pay of PAYMENTS) {
    if (pay.re.test(text)) {
      paymentHint = pay.name;
      text = text.replace(pay.re, " ");
      break;
    }
  }

  const marked = text.match(MARKED);
  const numbers = [...text.matchAll(NUMBERS)];
  const amountMatch = marked ?? numbers.at(-1);
  const amount = amountMatch ? parseAmount(amountMatch[1]) : null;
  if (amountMatch) text = text.replace(amountMatch[0], " ");

  text = text
    .replace(/\b(spent|spend|paid|using|with|on|for|rupees?|rs)\b/gi, " ")
    // "Rupees" in Hindi and Kannada; \b only knows Latin letters, so match on spaces.
    .replace(/(?:^|\s)(?:रुपये|रुपए|रुपया|ರೂಪಾಯಿ|ರೂ)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const name = text || raw.replace(amountMatch?.[0] ?? "", "").trim() || raw.trim();
  return {
    name,
    amount,
    merchantName: detectMerchantName(name),
    paymentHint,
  };
}
