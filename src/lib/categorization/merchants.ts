import type { Catalogs, Merchant } from "@/lib/types";
import type { CategorizeInput, CategorizeResult } from "./types";
import { detectMerchantName, normalizeMerchantName } from "./rules";

export function matchMerchant(
  input: CategorizeInput,
  merchants: Merchant[],
  catalogs?: Pick<Catalogs, "categories" | "subcategories">,
): CategorizeResult | null {
  const guessed = input.merchantName || detectMerchantName(`${input.name} ${input.notes ?? ""}`);
  if (!guessed) return null;
  const key = normalizeMerchantName(guessed);
  const merchant = merchants.find((m) => m.normalized_name === key);
  if (!merchant) return null;
  const category = catalogs?.categories.find((c) => c.id === merchant.default_category_id);
  const subcategory = catalogs?.subcategories.find((s) => s.id === merchant.default_subcategory_id);
  return {
    categoryName: category?.name ?? null,
    subcategoryName: subcategory?.name ?? null,
    merchantName: merchant.name,
    purchaseChannel: merchant.default_channel,
    paymentMethodName: null,
    confidence: category ? 0.9 : 0.86,
    source: "merchant",
    needsReview: false,
  };
}
