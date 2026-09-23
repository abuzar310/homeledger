import type { InsightInput, ReceiptDraft } from "@/lib/ai-types";
import type { CategorizeInput, CategorizeResult } from "@/lib/categorization/types";
import type { PurchaseChannel } from "@/lib/types";

export type { InsightInput, ReceiptDraft };

const CHANNELS: PurchaseChannel[] = ["online", "offline", "food_delivery", "restaurant", "store", "other"];

export const CATEGORY_GUIDE = `Groceries: Groceries, Vegetables, Fruits, Dairy, Meat, Snacks, Staples
Dining & Food: Dining Out, Food Delivery
Kitchen: Kitchen
Household: Cleaning, Household Supplies, Furniture, Appliances, Repairs & Maintenance
Shopping: Online Shopping, Clothing, Electronics, Personal Care, Other Shopping
Utilities: Electricity, Water, Gas, Internet, Mobile, DTH / TV
Transport: Fuel, Taxi / Cab, Public Transport, Parking / Toll, Vehicle Maintenance
Health: Medicine, Doctor, Hospital, Other Health
Education: Education, Books, Courses, Other
Entertainment: Subscriptions, Movies, Games, Other
Financial: EMI, Insurance, Bank Charges, Other
Other: Other
Payments: UPI, Cash, Credit Card, Debit Card, Bank Transfer, Other`;

export function googleAiKey(): string | undefined {
  const named = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  if (named) return named;
  const provider = (process.env.AI_PROVIDER || "").toLowerCase();
  if (provider === "google" || provider === "gemini") return process.env.AI_API_KEY;
  return undefined;
}

export function geminiModel(): string {
  return process.env.AI_MODEL || "gemini-3.6-flash";
}

export function parseModelJson<T>(text: string): T | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

export function toCategorizeResult(data: Partial<CategorizeResult> | null): CategorizeResult | null {
  if (!data?.categoryName) return null;
  const confidence = clamp01(data.confidence);
  const channel = CHANNELS.includes(data.purchaseChannel as PurchaseChannel)
    ? (data.purchaseChannel as PurchaseChannel)
    : null;
  return {
    categoryName: data.categoryName,
    subcategoryName: data.subcategoryName ?? null,
    merchantName: data.merchantName ?? null,
    purchaseChannel: channel,
    paymentMethodName: data.paymentMethodName ?? null,
    confidence,
    source: "ai",
    needsReview: confidence < 0.7,
  };
}

export function toReceiptDraft(data: Partial<ReceiptDraft> | null): ReceiptDraft | null {
  if (!data) return null;
  const amount = typeof data.amount === "number" && data.amount > 0 ? Math.round(data.amount) : null;
  const occurredOn = isoDate(data.occurredOn);
  const name = clean(data.name);
  if (!name && amount == null && !clean(data.merchantName)) return null;
  const items = Array.isArray(data.items)
    ? data.items
        .map((item) => ({
          name: clean((item as { name?: unknown }).name) ?? "",
          amount: typeof (item as { amount?: unknown }).amount === "number" ? Number((item as { amount: number }).amount) : 0,
        }))
        .filter((item) => item.name && item.amount > 0)
    : [];
  return {
    name,
    amount,
    occurredOn,
    merchantName: clean(data.merchantName),
    notes: clean(data.notes),
    categoryName: clean(data.categoryName),
    subcategoryName: clean(data.subcategoryName),
    paymentMethodName: clean(data.paymentMethodName),
    items,
  };
}

export function toInsightText(data: { text?: string } | null): string | null {
  const text = clean(data?.text);
  if (!text) return null;
  return text.length > 180 ? `${text.slice(0, 177).trim()}…` : text;
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function geminiJson<T>(parts: GeminiPart[]): Promise<T | null> {
  const key = googleAiKey();
  if (!key) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return parseModelJson<T>(text);
}

export async function categorizeWithGemini(input: CategorizeInput): Promise<CategorizeResult | null> {
  const data = await geminiJson<Partial<CategorizeResult>>([
    {
      text: `You categorise household expenses for HomeLedger in India.
Pick one category and one subcategory from this list:
${CATEGORY_GUIDE}
Return JSON only:
{"categoryName":"","subcategoryName":"","merchantName":"","purchaseChannel":"online|offline|food_delivery|restaurant|store|other|null","paymentMethodName":"","confidence":0.0}
Expense: ${input.name}
Notes: ${input.notes ?? ""}
Merchant: ${input.merchantName ?? ""}`,
    },
  ]);
  return toCategorizeResult(data);
}

export async function parseReceiptWithGemini(mime: string, data: string): Promise<ReceiptDraft | null> {
  const parsed = await geminiJson<Partial<ReceiptDraft>>([
    { inline_data: { mime_type: mime, data } },
    {
      text: `Read this Indian household receipt. Use rupees as a number, date as YYYY-MM-DD.
Pick category/subcategory from:
${CATEGORY_GUIDE}
Return JSON only:
{"name":"","amount":0,"occurredOn":"","merchantName":"","notes":"","categoryName":"","subcategoryName":"","paymentMethodName":"","items":[{"name":"","amount":0}]}`,
    },
  ]);
  return toReceiptDraft(parsed);
}

export async function insightWithGemini(input: InsightInput): Promise<string | null> {
  const top = input.top.map((row) => `${row.name} ₹${row.total}`).join(", ") || "none";
  const data = await geminiJson<{ text?: string }>([
    {
      text: `One calm sentence about this household month. Facts only. No advice, no guilt, no emojis.
Month ${input.month}. Spent ₹${input.total} across ${input.count} spends. Last month ₹${input.previous}. Top: ${top}.
JSON: {"text":""}`,
    },
  ]);
  return toInsightText(data);
}

function clamp01(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.6;
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next ? next : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
