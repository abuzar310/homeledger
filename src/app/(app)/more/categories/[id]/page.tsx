"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useHousehold } from "@/components/HouseholdProvider";
import { Card } from "@/components/ui";
import { deleteCatalogRow, isOwnRow, updateCatalogRow } from "@/lib/catalog-edit";
import { monthKey } from "@/lib/dates";
import { clearCatalogCache } from "@/lib/household";
import { clearMonthCache } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import { CategorySheet } from "../CategorySheet";

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { catalogs, household, loading, refresh } = useHousehold();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const category = catalogs.categories.find((c) => c.id === id);
  const subs = catalogs.subcategories.filter((s) => s.category_id === id);
  const month = monthKey();
  const own = category ? isOwnRow(category, household?.id) : false;

  /** Pickers and reports read cached catalogs and months, so drop both and load fresh ones. */
  async function reload(): Promise<boolean> {
    clearCatalogCache();
    clearMonthCache();
    try {
      await refresh();
      return true;
    } catch {
      return false;
    }
  }

  async function save(name: string, color: string) {
    if (!household || !category) throw new Error("Category not ready");
    await updateCatalogRow(createClient(), "categories", household.id, category.id, { name, color });
    setNotice((await reload()) ? null : "Saved. Reopen this screen if the old name still shows.");
  }

  async function remove() {
    if (!household || !category) throw new Error("Category not ready");
    await deleteCatalogRow(createClient(), "categories", household.id, category.id);
    router.replace("/more/categories");
    await reload();
  }

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
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{category?.group_name ?? "Category"}</p>
          <h1 className="text-[22px] font-semibold">{category?.name ?? "Category"}</h1>
        </div>
        {own ? (
          <button
            type="button"
            className="press min-h-11 shrink-0 rounded-xl px-2 text-[15px] font-semibold text-primary"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        ) : null}
      </div>
      {notice ? (
        <p className="text-[15px] text-muted" role="status">
          {notice}
        </p>
      ) : null}
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
      {own && category ? (
        <>
          <button
            type="button"
            className="press min-h-11 w-full text-[15px] font-semibold text-danger"
            onClick={() => setRemoving(true)}
          >
            Delete category
          </button>
          <CategorySheet
            open={editing}
            title="Edit category"
            saveLabel="Save"
            initialName={category.name}
            initialColor={category.color}
            existing={catalogs.categories}
            exceptId={category.id}
            onSave={save}
            onClose={() => setEditing(false)}
          />
          <ConfirmDialog
            open={removing}
            title={`Delete ${category.name}?`}
            body="Its expenses stay but become Uncategorised, shown as Other in reports. Budgets set for it are deleted. Recurring bills and merchants that used it keep going with no category."
            confirmLabel="Delete"
            busyLabel="Deleting…"
            danger
            onConfirm={remove}
            onClose={() => setRemoving(false)}
          />
        </>
      ) : null}
    </div>
  );
}
