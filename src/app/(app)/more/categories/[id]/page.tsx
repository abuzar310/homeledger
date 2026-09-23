"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card } from "@/components/ui";
import { monthKey } from "@/lib/dates";

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { catalogs, loading } = useHousehold();
  const category = catalogs.categories.find((c) => c.id === id);
  const subs = catalogs.subcategories.filter((s) => s.category_id === id);
  const month = monthKey();

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading category">
        <div className="skeleton h-16 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="page-sheet space-y-4">
      <button className="min-h-11 text-[15px] font-semibold text-primary" onClick={() => router.back()}>
        Back
      </button>
      <div>
        <p className="text-[13px] text-muted">{category?.group_name ?? "Category"}</p>
        <h1 className="text-[22px] font-semibold">{category?.name ?? "Category"}</h1>
      </div>
      <Card>
        <h2 className="mb-2 text-[16px] font-semibold">Subcategories</h2>
        {subs.length ? (
          <ul>
            {subs.map((sub) => (
              <li key={sub.id} className="border-b border-line py-3 last:border-0">
                {sub.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-muted">No subcategories for this category.</p>
        )}
      </Card>
      <Link
        href={`/reports/category/${id}?month=${month}`}
        className="press inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-[16px] font-semibold text-on-primary"
      >
        See this month
      </Link>
    </div>
  );
}
