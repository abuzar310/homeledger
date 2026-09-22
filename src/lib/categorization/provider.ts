import type { CategorizeInput, CategorizeResult, AiProvider } from "./types";

class EnvAiProvider implements AiProvider {
  id = process.env.AI_PROVIDER || "none";

  async categorize(input: CategorizeInput): Promise<CategorizeResult | null> {
    const key = process.env.AI_API_KEY;
    const endpoint = process.env.AI_API_URL;
    if (!key || !endpoint) return null;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "default",
          input,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Partial<CategorizeResult>;
      if (!data.categoryName) return null;
      return {
        categoryName: data.categoryName ?? null,
        subcategoryName: data.subcategoryName ?? null,
        merchantName: data.merchantName ?? null,
        purchaseChannel: data.purchaseChannel ?? null,
        paymentMethodName: data.paymentMethodName ?? null,
        confidence: typeof data.confidence === "number" ? data.confidence : 0.6,
        source: "ai",
        needsReview: (data.confidence ?? 0.6) < 0.7,
      };
    } catch {
      return null;
    }
  }
}

let provider: AiProvider = new EnvAiProvider();

export function setAiProvider(next: AiProvider) {
  provider = next;
}

export function getAiProvider(): AiProvider {
  return provider;
}

export async function categorizeWithAi(input: CategorizeInput): Promise<CategorizeResult | null> {
  return provider.categorize(input);
}
