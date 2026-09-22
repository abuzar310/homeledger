"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useHousehold } from "@/components/HouseholdProvider";
import { ScreenTitle } from "@/components/ui";
import { categoryIcon } from "@/lib/icons";
import { monthKey } from "@/lib/dates";

export default function CategoriesPage() {
  const { catalogs } = useHousehold();
  const month = monthKey();
  const groups = new Map<string, typeof catalogs.categories>();
  for (const category of catalogs.categories) {
    const list = groups.get(category.group_name) ?? [];
    list.push(category);
    groups.set(category.group_name, list);
  }

  return (
    <div className="space-y-6">
      <ScreenTitle title="Categories" />
      <p className="text-[15px] text-muted">These help organise expenses automatically. You can still change any expense.</p>
      {[...groups.entries()].map(([group, cats]) => (
        <section key={group}>
          <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">{group}</h2>
          <ul className="divide-y divide-line border-y border-line">
            {cats.map((cat) => {
              const Icon = categoryIcon(cat.name);
              const subs = catalogs.subcategories.filter((s) => s.category_id === cat.id);
              return (
                <li key={cat.id}>
                  <Link
                    href={`/reports/category/${cat.id}?month=${month}`}
                    className="press flex min-h-14 items-center gap-3 py-2"
                  >
                    <Icon className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-medium">{cat.name}</span>
                      {subs.length ? (
                        <span className="block truncate text-[13px] text-muted">{subs.map((s) => s.name).join(" · ")}</span>
                      ) : null}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
