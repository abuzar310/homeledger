"use client";

import { useHousehold } from "@/components/HouseholdProvider";
import { Card, ScreenTitle } from "@/components/ui";

export default function CategoriesPage() {
  const { catalogs } = useHousehold();
  const groups = new Map<string, typeof catalogs.categories>();
  for (const category of catalogs.categories) {
    const list = groups.get(category.group_name) ?? [];
    list.push(category);
    groups.set(category.group_name, list);
  }

  return (
    <div className="space-y-4">
      <ScreenTitle title="Categories" />
      <p className="text-[15px] text-muted">These help organise expenses automatically. You can still change any expense.</p>
      {[...groups.entries()].map(([group, cats]) => (
        <Card key={group}>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">{group}</h2>
          <ul>
            {cats.map((cat) => {
              const subs = catalogs.subcategories.filter((s) => s.category_id === cat.id);
              return (
                <li key={cat.id} className="border-b border-line py-3 last:border-0">
                  <p className="font-medium">{cat.name}</p>
                  <p className="text-[13px] text-muted">{subs.map((s) => s.name).join(" · ")}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
