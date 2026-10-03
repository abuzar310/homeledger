import Link from "next/link";
import { Apple, Car, House, Milk, ShoppingCart, Utensils, Carrot, Zap } from "lucide-react";
import { QUICK_CHIPS } from "@/lib/fill";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  milk: Milk,
  groceries: ShoppingCart,
  food: Utensils,
  fruits: Apple,
  vegetables: Carrot,
  bills: Zap,
  household: House,
  transport: Car,
};

export function QuickAddGrid() {
  return (
    <section>
      <h2 className="section-label mb-3">Add expenses</h2>
      <div className="grid grid-cols-4 gap-3">
        {QUICK_CHIPS.map((chip) => {
          const Icon = ICONS[chip.id] ?? ShoppingCart;
          return (
            <Link
              key={chip.id}
              href={`/add?chip=${chip.id}`}
              className="press flex flex-col items-center gap-2 rounded-2xl px-1 py-2 text-center"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-deep">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-[12px] font-medium text-muted">{chip.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
