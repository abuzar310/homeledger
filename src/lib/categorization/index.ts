import type { Catalogs, Category, Merchant, PurchaseChannel, Subcategory } from "@/lib/types";
import { matchMerchant } from "./merchants";
import { detectMerchantName, matchRules } from "./rules";
import { categorizeWithAi } from "./provider";
import type { CategorizeInput, CategorizeResult } from "./types";

export type ResolvedCategorization = {
  categoryId: string | null;
  subcategoryId: string | null;
  merchantName: string | null;
  purchaseChannel: PurchaseChannel | null;
  paymentMethodId: string | null;
  confidence: number;
  source: CategorizeResult["source"];
  needsReview: boolean;
};

export function suggestCategoryLocal(
  input: CategorizeInput,
  catalogs: Catalogs,
  merchants: Merchant[] = [],
): ResolvedCategorization | null {
  const result = mergeResults(matchRules(input), matchMerchant(input, merchants, catalogs));
  if (!result?.categoryName) return null;
  const category = findCategory(catalogs.categories, result.categoryName);
  if (!category) return null;
  const subcategory = findSubcategory(catalogs.subcategories, category.id, result.subcategoryName);
  const payment = catalogs.paymentMethods.find(
    (p) => p.name.toLowerCase() === (result.paymentMethodName ?? "").toLowerCase(),
  );
  return {
    categoryId: category.id,
    subcategoryId: subcategory?.id ?? null,
    merchantName: result.merchantName,
    purchaseChannel: result.purchaseChannel,
    paymentMethodId: payment?.id ?? null,
    confidence: result.confidence,
    source: result.source,
    needsReview: result.needsReview || result.confidence < 0.7,
  };
}

export async function categorizeExpense(
  input: CategorizeInput,
  catalogs: Catalogs,
  merchants: Merchant[] = [],
): Promise<ResolvedCategorization> {
  const rule = matchRules(input);
  const merchant = matchMerchant(input, merchants, catalogs);
  let result = mergeResults(rule, merchant);

  if (!result || result.confidence < 0.7) {
    const ai = await categorizeWithAi(input);
    if (ai) result = mergeResults(result, ai);
  }

  if (!result) {
    return {
      categoryId: findCategory(catalogs.categories, "Other")?.id ?? null,
      subcategoryId: findSubcategory(catalogs.subcategories, findCategory(catalogs.categories, "Other")?.id, "Other")?.id ?? null,
      merchantName: detectMerchantName(input.name) ?? input.merchantName ?? null,
      purchaseChannel: null,
      paymentMethodId: null,
      confidence: 0,
      source: "none",
      needsReview: true,
    };
  }

  const category = findCategory(catalogs.categories, result.categoryName);
  const subcategory = findSubcategory(catalogs.subcategories, category?.id, result.subcategoryName);
  const payment = catalogs.paymentMethods.find(
    (p) => p.name.toLowerCase() === (result.paymentMethodName ?? "").toLowerCase(),
  );

  return {
    categoryId: category?.id ?? null,
    subcategoryId: subcategory?.id ?? null,
    merchantName: result.merchantName,
    purchaseChannel: result.purchaseChannel,
    paymentMethodId: payment?.id ?? null,
    confidence: result.confidence,
    source: result.source,
    needsReview: result.needsReview || result.confidence < 0.7,
  };
}

function mergeResults(
  a: CategorizeResult | null,
  b: CategorizeResult | null,
): CategorizeResult | null {
  if (!a) return b;
  if (!b) return a;
  return {
    categoryName: a.categoryName ?? b.categoryName,
    subcategoryName: a.subcategoryName ?? b.subcategoryName,
    merchantName: a.merchantName ?? b.merchantName,
    purchaseChannel: a.purchaseChannel ?? b.purchaseChannel,
    paymentMethodName: a.paymentMethodName ?? b.paymentMethodName,
    confidence: Math.max(a.confidence, b.confidence),
    source: a.confidence >= b.confidence ? a.source : b.source,
    needsReview: Math.max(a.confidence, b.confidence) < 0.7,
  };
}

function findCategory(categories: Category[], name: string | null): Category | undefined {
  if (!name) return undefined;
  return categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

function findSubcategory(
  subcategories: Subcategory[],
  categoryId: string | undefined,
  name: string | null,
): Subcategory | undefined {
  if (!name || !categoryId) return undefined;
  return subcategories.find(
    (s) => s.category_id === categoryId && s.name.toLowerCase() === name.toLowerCase(),
  );
}

export { matchRules, detectMerchantName, normalizeMerchantName } from "./rules";
export type { CategorizeInput, CategorizeResult } from "./types";
