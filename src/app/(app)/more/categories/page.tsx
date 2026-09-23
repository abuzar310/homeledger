"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useHousehold } from "@/components/HouseholdProvider";
import { ScreenTitle } from "@/components/ui";
import { categoryIcon } from "@/lib/icons";

export default function CategoriesPage() {
  const { catalogs, loading } = useHousehold();
  const groups = new Map<string, typeof catalogs.categories>();
  for (const category of catalogs.categories) {
    const list = groups.get(category.group_name) ?? [];
    list.push(category);
    groups.set(category.group_name, list);
  }

  return (
    <div className="space-y-5">
      <ScreenTitle title="Categories" />
      <p className="text-[15px] text-muted">These help organise expenses automatically. You can still change any expense.</p>
      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading categories">
          <div className="skeleton h-14 rounded-2xl" />
          <div className="skeleton h-14 rounded-2xl" />
          <div className="skeleton h-14 rounded-2xl" />
        </div>
      ) : null}
      {!loading && !catalogs.categories.length ? (
        <p className="text-[15px] text-muted">Categories will appear once your home is ready.</p>
      ) : null}
      {!loading &&
        [...groups.entries()].map(([group, cats]) => (
          <section key={group}>
            <h2 className="mb-2 text-[13px] font-medium text-muted">{group}</h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {cats.map((cat) => {
                const Icon = categoryIcon(cat.name);
                return (
                  <Link
                    key={cat.id}
                    href={`/more/categories/${cat.id}`}
                    className="press flex min-h-14 items-center gap-3 border-b border-line px-3 last:border-0"
                  >
                    <Icon className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                    <span className="min-w-0 flex-1 text-[16px] font-medium">{cat.name}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
