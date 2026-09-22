export type PurchaseChannel =
  | "online"
  | "offline"
  | "food_delivery"
  | "restaurant"
  | "store"
  | "other";

export type CategorizationSource = "none" | "rule" | "merchant" | "ai" | "user";

export type Category = {
  id: string;
  household_id: string | null;
  name: string;
  group_name: string;
  color: string;
  sort_order: number;
  is_system: boolean;
};

export type Subcategory = {
  id: string;
  household_id: string | null;
  category_id: string;
  name: string;
  sort_order: number;
  is_system: boolean;
};

export type PaymentMethod = {
  id: string;
  household_id: string | null;
  name: string;
  sort_order: number;
  is_system: boolean;
};

export type Merchant = {
  id: string;
  household_id: string;
  name: string;
  normalized_name: string;
  default_category_id: string | null;
  default_subcategory_id: string | null;
  default_channel: PurchaseChannel | null;
};

export type TransactionItem = {
  id: string;
  transaction_id: string;
  name: string;
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
  sort_order: number;
};

export type Receipt = {
  id: string;
  household_id: string;
  transaction_id: string | null;
  storage_path: string;
  file_name: string;
  created_at: string;
};

export type Transaction = {
  id: string;
  household_id: string;
  member_id: string | null;
  created_by: string | null;
  name: string;
  amount: number;
  occurred_on: string;
  category_id: string | null;
  subcategory_id: string | null;
  merchant_id: string | null;
  payment_method_id: string | null;
  purchase_channel: PurchaseChannel | null;
  notes: string | null;
  needs_review: boolean;
  categorization_source: CategorizationSource;
  categorization_confidence: number | null;
  client_request_id: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  subcategory?: Subcategory | null;
  merchant?: Merchant | null;
  payment_method?: PaymentMethod | null;
  items?: TransactionItem[];
  receipts?: Receipt[];
};

export type Budget = {
  id: string;
  household_id: string;
  category_id: string | null;
  year_month: string;
  amount: number;
};

export type Catalogs = {
  categories: Category[];
  subcategories: Subcategory[];
  paymentMethods: PaymentMethod[];
};

export type Household = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export const CHANNEL_LABELS: Record<PurchaseChannel, string> = {
  online: "Online",
  offline: "Offline",
  food_delivery: "Food Delivery",
  restaurant: "Restaurant",
  store: "Store",
  other: "Other",
};

export const CHANNELS: PurchaseChannel[] = [
  "online",
  "offline",
  "food_delivery",
  "restaurant",
  "store",
  "other",
];
