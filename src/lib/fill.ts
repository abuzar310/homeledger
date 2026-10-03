import type { Catalogs, Category, Subcategory } from "@/lib/types";

export type FillKind = "qty" | "name" | "bills";

export type FillTemplate = {
  id: string;
  label: string;
  kind: FillKind;
  categoryName: string;
  subcategoryName?: string;
  defaultName?: string;
  qtyLabel?: string;
};

export const FILL_TEMPLATES: FillTemplate[] = [
  { id: "milk", label: "Milk", kind: "qty", categoryName: "Groceries", subcategoryName: "Dairy", defaultName: "Milk", qtyLabel: "Litre" },
  { id: "groceries", label: "Groceries", kind: "name", categoryName: "Groceries", subcategoryName: "Groceries" },
  { id: "fruits", label: "Fruits", kind: "name", categoryName: "Groceries", subcategoryName: "Fruits" },
  { id: "vegetables", label: "Vegetables", kind: "name", categoryName: "Groceries", subcategoryName: "Vegetables" },
  { id: "food", label: "Food", kind: "name", categoryName: "Dining & Food" },
  { id: "bills", label: "Bills", kind: "bills", categoryName: "Utilities" },
  { id: "household", label: "Home", kind: "name", categoryName: "Household" },
  { id: "transport", label: "Travel", kind: "name", categoryName: "Transport" },
];

export const QUICK_CHIPS = [
  { id: "milk", label: "Milk" },
  { id: "groceries", label: "Groceries" },
  { id: "food", label: "Food" },
  { id: "fruits", label: "Fruits" },
  { id: "vegetables", label: "Vegetables" },
  { id: "bills", label: "Bills" },
  { id: "household", label: "Home", categoryName: "Household" },
  { id: "transport", label: "Travel", categoryName: "Transport" },
] as const;

export function matchCategory(catalogs: Catalogs, name: string): Category | undefined {
  return catalogs.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export function matchSubcategory(catalogs: Catalogs, categoryId: string, name?: string): Subcategory | undefined {
  if (!name) return undefined;
  return catalogs.subcategories.find(
    (s) => s.category_id === categoryId && s.name.toLowerCase() === name.toLowerCase(),
  );
}

export function resolveTemplate(catalogs: Catalogs, template: FillTemplate) {
  const category = matchCategory(catalogs, template.categoryName);
  const subcategory = category ? matchSubcategory(catalogs, category.id, template.subcategoryName) : undefined;
  return { category, subcategory };
}

export function templateById(id: string): FillTemplate | undefined {
  return FILL_TEMPLATES.find((row) => row.id === id);
}
