import { requestCategorize } from "@/lib/ai-client";
import type { CategorizeInput, CategorizeResult, AiProvider } from "./types";

class EnvAiProvider implements AiProvider {
  id = "gemini";

  async categorize(input: CategorizeInput): Promise<CategorizeResult | null> {
    if (process.env.VITEST) return null;
    return requestCategorize(input);
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
