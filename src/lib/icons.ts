import {
  Apple,
  Banknote,
  BookOpen,
  Car,
  Carrot,
  CircleHelp,
  Clapperboard,
  CookingPot,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Milk,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Utensils,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const CATEGORY: Record<string, LucideIcon> = {
  groceries: ShoppingCart,
  "dining & food": Utensils,
  kitchen: CookingPot,
  household: House,
  shopping: ShoppingBag,
  utilities: Zap,
  transport: Car,
  health: HeartPulse,
  education: GraduationCap,
  entertainment: Clapperboard,
  financial: Landmark,
  other: CircleHelp,
  milk: Milk,
  dairy: Milk,
  fruits: Apple,
  vegetables: Carrot,
  "repairs & maintenance": Wrench,
};

export function categoryIcon(name?: string | null): LucideIcon {
  if (!name) return ReceiptText;
  return CATEGORY[name.toLowerCase()] ?? CircleHelp;
}

export {
  Banknote,
  BookOpen,
  ReceiptText,
  Store,
  Tag,
  Wallet,
};
export type { LucideIcon };
