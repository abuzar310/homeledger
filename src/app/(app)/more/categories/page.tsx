"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useHousehold } from "@/components/HouseholdProvider";
import { ScreenTitle } from "@/components/ui";
import { addCatalogRow, CUSTOM_GROUP, isOwnRow, nextSortOrder } from "@/lib/catalog-edit";
import { clearCatalogCache } from "@/lib/household";
import { categoryIcon, Tag } from "@/lib/icons";
import { clearMonthCache } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import { CategorySheet } from "./CategorySheet";

export default function CategoriesPage() {
  const { catalogs, household, loading, refresh } = useHousehold();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const groups = new Map<string, typeof catalogs.categories>();
  for (const category of catalogs.categories) {
    const list = groups.get(category.group_name) ?? [];
    list.push(category);
    groups.set(category.group_name, list);
  }

  async function addCategory(name: string, color: string) {
    if (!household) throw new Error("Household not ready");
    await addCatalogRow(createClient(), "categories", household.id, {
      name,
      color,
      group_name: CUSTOM_GROUP,
      sort_order: nextSortOrder(catalogs.categories),
    });
    clearCatalogCache();
    clearMonthCache();
    setNotice(null);
    try {
      await refresh();
    } catch {
      setNotice(`${name} was added. Reopen this screen if it does not show yet.`);
    }
  }

  return (
    <div className="space-y-5">
      <ScreenTitle
        title="Categories"
        action={
          <button
            type="button"
            className="press min-h-11 shrink-0 rounded-xl px-2 text-[15px] font-semibold text-primary disabled:opacity-45"
            disabled={!household}
            onClick={() => setAdding(true)}
          >
            Add category
          </button>
        }
      />
      <p className="text-[15px] text-muted">These help organise expenses automatically. You can still change any expense, or add your own category.</p>
      {notice ? (
        <p className="text-[15px] text-muted" role="status">
          {notice}
        </p>
      ) : null}
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
                const own = isOwnRow(cat, household?.id);
                const Icon = own ? Tag : categoryIcon(cat.name);
                return (
                  <Link
                    key={cat.id}
                    href={`/more/categories/${cat.id}`}
                    className="press flex min-h-14 items-center gap-3 border-b border-line px-3 last:border-0"
                  >
                    <Icon
                      className="size-5 shrink-0 text-primary"
                      style={own ? { color: cat.color } : undefined}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 text-[16px] font-medium">{cat.name}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

      <CategorySheet
        open={adding}
        title="Add a category"
        saveLabel="Add category"
        existing={catalogs.categories}
        onSave={addCategory}
        onClose={() => setAdding(false)}
      />
    </div>
  );
}
