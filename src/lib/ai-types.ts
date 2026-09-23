export type ReceiptDraft = {
  name: string | null;
  amount: number | null;
  occurredOn: string | null;
  merchantName: string | null;
  notes: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  paymentMethodName: string | null;
};

export type InsightInput = {
  month: string;
  total: number;
  previous: number;
  count: number;
  top: { name: string; total: number }[];
};
