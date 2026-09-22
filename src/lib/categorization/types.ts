import type { PurchaseChannel } from "@/lib/types";

export type CategorizeInput = {
  name: string;
  notes?: string;
  merchantName?: string;
};

export type CategorizeResult = {
  categoryName: string | null;
  subcategoryName: string | null;
  merchantName: string | null;
  purchaseChannel: PurchaseChannel | null;
  paymentMethodName: string | null;
  confidence: number;
  source: "rule" | "merchant" | "ai" | "none";
  needsReview: boolean;
};

export type AiProvider = {
  id: string;
  categorize(input: CategorizeInput): Promise<CategorizeResult | null>;
};
