import type { Merchant } from "@/lib/types";
import type { CategorizeInput, CategorizeResult } from "./types";
import { detectMerchantName, normalizeMerchantName } from "./rules";

export function matchMerchant(
  input: CategorizeInput,
  merchants: Merchant[],
): CategorizeResult | null {
  const guessed = input.merchantName || detectMerchantName(`${input.name} ${input.notes ?? ""}`);
  if (!guessed) return null;
  const key = normalizeMerchantName(guessed);
  const merchant = merchants.find((m) => m.normalized_name === key);
  if (!merchant) return null;
  return {
    categoryName: null,
    subcategoryName: null,
    merchantName: merchant.name,
    purchaseChannel: merchant.default_channel,
    paymentMethodName: null,
    confidence: 0.86,
    source: "merchant",
    needsReview: false,
  };
}
