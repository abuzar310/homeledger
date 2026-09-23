import type { PurchaseChannel } from "@/lib/types";
import type { CategorizeInput, CategorizeResult } from "./types";

type Rule = {
  keywords: string[];
  categoryName: string;
  subcategoryName: string;
  merchantName?: string;
  purchaseChannel?: PurchaseChannel;
  paymentMethodName?: string;
  confidence?: number;
};

const RULES: Rule[] = [
  { keywords: ["nandini", "amul", "milk", "curd", "dahi", "yogurt", "butter", "ghee", "paneer", "cheese"], categoryName: "Groceries", subcategoryName: "Dairy", confidence: 0.92 },
  { keywords: ["vegetable", "vegetables", "sabzi", "tomato", "onion", "potato", "carrot", "spinach", "palak"], categoryName: "Groceries", subcategoryName: "Vegetables", purchaseChannel: "store", confidence: 0.9 },
  { keywords: ["apple", "banana", "mango", "orange", "fruit", "fruits"], categoryName: "Groceries", subcategoryName: "Fruits", confidence: 0.88 },
  { keywords: ["rice", "atta", "wheat", "dal", "toor", "oil", "cooking oil", "sugar", "salt", "flour", "staples"], categoryName: "Groceries", subcategoryName: "Staples", confidence: 0.9 },
  { keywords: ["chicken", "mutton", "fish", "egg", "eggs", "meat"], categoryName: "Groceries", subcategoryName: "Meat", confidence: 0.88 },
  { keywords: ["chips", "biscuit", "namkeen", "snack", "chocolate"], categoryName: "Groceries", subcategoryName: "Snacks", confidence: 0.8 },
  { keywords: ["grocery", "groceries", "supermarket", "big bazaar", "reliance fresh", "more supermarket"], categoryName: "Groceries", subcategoryName: "Groceries", purchaseChannel: "store", confidence: 0.84 },
  { keywords: ["swiggy", "zomato", "food delivery", "eatsure"], categoryName: "Dining & Food", subcategoryName: "Food Delivery", merchantName: undefined, purchaseChannel: "food_delivery", confidence: 0.93 },
  { keywords: ["biryani", "pizza", "burger", "dosa", "idli", "restaurant", "cafe", "lunch", "dinner"], categoryName: "Dining & Food", subcategoryName: "Dining Out", purchaseChannel: "restaurant", confidence: 0.8 },
  { keywords: ["amazon", "flipkart", "myntra", "meesho", "ajio"], categoryName: "Shopping", subcategoryName: "Online Shopping", purchaseChannel: "online", confidence: 0.72 },
  { keywords: ["shirt", "saree", "kurta", "jeans", "clothing", "dress"], categoryName: "Shopping", subcategoryName: "Clothing", confidence: 0.82 },
  { keywords: ["phone", "laptop", "earphones", "headphones", "keyboard", "mouse", "charger", "monitor", "tablet", "speaker", "power bank", "usb", "electronics"], categoryName: "Shopping", subcategoryName: "Electronics", confidence: 0.8 },
  { keywords: ["shampoo", "soap", "toothpaste", "cream", "personal care"], categoryName: "Shopping", subcategoryName: "Personal Care", confidence: 0.84 },
  { keywords: ["frying pan", "cooker", "mixer", "kitchen rack", "utensil"], categoryName: "Kitchen", subcategoryName: "Kitchen", confidence: 0.86 },
  { keywords: ["detergent", "phenyl", "cleaner", "cleaning"], categoryName: "Household", subcategoryName: "Cleaning", confidence: 0.86 },
  { keywords: ["bescom", "electricity", "current bill", "power bill"], categoryName: "Utilities", subcategoryName: "Electricity", merchantName: "BESCOM", purchaseChannel: "offline", confidence: 0.95 },
  { keywords: ["water bill", "bwssb"], categoryName: "Utilities", subcategoryName: "Water", confidence: 0.9 },
  { keywords: ["gas", "lpg", "indane", "hp gas"], categoryName: "Utilities", subcategoryName: "Gas", confidence: 0.9 },
  { keywords: ["jio fiber", "airtel fiber", "wifi", "broadband", "internet"], categoryName: "Utilities", subcategoryName: "Internet", confidence: 0.9 },
  { keywords: ["jio recharge", "airtel recharge", "mobile recharge", "prepaid"], categoryName: "Utilities", subcategoryName: "Mobile", confidence: 0.88 },
  { keywords: ["dth", "tata play", "dish tv"], categoryName: "Utilities", subcategoryName: "DTH / TV", confidence: 0.88 },
  { keywords: ["petrol", "diesel", "fuel", "hp petrol", "indian oil"], categoryName: "Transport", subcategoryName: "Fuel", purchaseChannel: "store", confidence: 0.94 },
  { keywords: ["uber", "ola", "rapido", "taxi", "cab", "auto"], categoryName: "Transport", subcategoryName: "Taxi / Cab", purchaseChannel: "online", confidence: 0.9 },
  { keywords: ["bus", "metro", "train", "bmrcl"], categoryName: "Transport", subcategoryName: "Public Transport", confidence: 0.86 },
  { keywords: ["parking", "toll", "fastag"], categoryName: "Transport", subcategoryName: "Parking / Toll", confidence: 0.86 },
  { keywords: ["service center", "puncture", "car service"], categoryName: "Transport", subcategoryName: "Vehicle Maintenance", confidence: 0.82 },
  { keywords: ["medicine", "pharmacy", "apollo pharmacy", "tablet", "syrup"], categoryName: "Health", subcategoryName: "Medicine", confidence: 0.9 },
  { keywords: ["doctor", "clinic", "consultation"], categoryName: "Health", subcategoryName: "Doctor", confidence: 0.9 },
  { keywords: ["hospital", "scan", "lab test"], categoryName: "Health", subcategoryName: "Hospital", confidence: 0.86 },
  { keywords: ["school", "tuition", "fees", "college"], categoryName: "Education", subcategoryName: "Education", confidence: 0.84 },
  { keywords: ["book", "notebook"], categoryName: "Education", subcategoryName: "Books", confidence: 0.78 },
  { keywords: ["netflix", "hotstar", "prime", "spotify", "youtube premium", "subscription"], categoryName: "Entertainment", subcategoryName: "Subscriptions", purchaseChannel: "online", confidence: 0.93 },
  { keywords: ["movie", "pvr", "inox", "cinema"], categoryName: "Entertainment", subcategoryName: "Movies", confidence: 0.88 },
  { keywords: ["emi", "loan"], categoryName: "Financial", subcategoryName: "EMI", confidence: 0.84 },
  { keywords: ["insurance", "lic"], categoryName: "Financial", subcategoryName: "Insurance", confidence: 0.84 },
];

function haystack(input: CategorizeInput): string {
  return [input.name, input.notes, input.merchantName].filter(Boolean).join(" ").toLowerCase();
}

export function matchRules(input: CategorizeInput): CategorizeResult | null {
  const text = haystack(input);
  if (!text.trim()) return null;

  let best: { rule: Rule; score: number } | null = null;
  for (const rule of RULES) {
    const hits = rule.keywords.filter((k) => text.includes(k)).length;
    if (!hits) continue;
    const score = (rule.confidence ?? 0.8) + (hits - 1) * 0.03;
    if (!best || score > best.score) best = { rule, score };
  }
  if (!best) return null;

  const merchantFromText = detectMerchantName(text);
  const confidence = Math.min(0.97, best.score);
  const merchantChannel: PurchaseChannel | null =
    merchantFromText && ["Amazon", "Flipkart", "Myntra"].includes(merchantFromText)
      ? "online"
      : merchantFromText && ["Swiggy", "Zomato"].includes(merchantFromText)
        ? "food_delivery"
        : null;
  return {
    categoryName: best.rule.categoryName,
    subcategoryName: best.rule.subcategoryName,
    merchantName: best.rule.merchantName ?? merchantFromText ?? input.merchantName ?? null,
    purchaseChannel: best.rule.purchaseChannel ?? merchantChannel ?? null,
    paymentMethodName: best.rule.paymentMethodName ?? null,
    confidence,
    source: "rule",
    needsReview: confidence < 0.7,
  };
}

const KNOWN_MERCHANTS: { match: string; name: string }[] = [
  { match: "amazon", name: "Amazon" },
  { match: "flipkart", name: "Flipkart" },
  { match: "myntra", name: "Myntra" },
  { match: "swiggy", name: "Swiggy" },
  { match: "zomato", name: "Zomato" },
  { match: "bescom", name: "BESCOM" },
  { match: "netflix", name: "Netflix" },
  { match: "uber", name: "Uber" },
  { match: "ola", name: "Ola" },
  { match: "reliance", name: "Reliance" },
  { match: "nandini", name: "Nandini" },
];

export function detectMerchantName(text: string): string | null {
  const lower = text.toLowerCase();
  const found = KNOWN_MERCHANTS.find((m) => lower.includes(m.match));
  return found?.name ?? null;
}

export function normalizeMerchantName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
