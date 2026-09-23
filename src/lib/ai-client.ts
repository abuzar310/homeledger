import type { InsightInput, ReceiptDraft } from "@/lib/ai-types";
import type { CategorizeInput, CategorizeResult } from "@/lib/categorization/types";

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function requestCategorize(input: CategorizeInput): Promise<CategorizeResult | null> {
  const data = await postJson<{ result?: CategorizeResult | null }>("/api/ai/categorize", input);
  return data?.result ?? null;
}

export async function requestReceiptRead(file: File): Promise<ReceiptDraft | null> {
  if (file.size > 3_500_000) return null;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(",");
  const payload = await postJson<{ result?: ReceiptDraft | null }>("/api/ai/receipt", {
    mime: file.type || "image/jpeg",
    data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
  });
  return payload?.result ?? null;
}

export async function requestMonthInsight(input: InsightInput): Promise<string | null> {
  const data = await postJson<{ text?: string | null }>("/api/ai/insight", input);
  return data?.text ?? null;
}
