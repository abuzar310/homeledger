import { describe, expect, it } from "vitest";
import { FILL_TEMPLATES, matchCategory, resolveTemplate, templateById } from "./fill";
import type { Catalogs } from "./types";

const catalogs: Catalogs = {
  categories: [
    { id: "g", household_id: null, name: "Groceries", group_name: "Food", color: "#3F7D5A", sort_order: 1, is_system: true },
    { id: "u", household_id: null, name: "Utilities", group_name: "Bills", color: "#4A6B8C", sort_order: 2, is_system: true },
  ],
  subcategories: [
    { id: "d", household_id: null, category_id: "g", name: "Dairy", sort_order: 1, is_system: true },
    { id: "e", household_id: null, category_id: "u", name: "Electricity", sort_order: 1, is_system: true },
  ],
  paymentMethods: [],
};

describe("fill templates", () => {
  it("maps Milk to Groceries / Dairy", () => {
    const milk = templateById("milk");
    expect(milk?.kind).toBe("qty");
    const resolved = resolveTemplate(catalogs, FILL_TEMPLATES[0]);
    expect(resolved.category?.name).toBe("Groceries");
    expect(resolved.subcategory?.name).toBe("Dairy");
  });

  it("finds Utilities for bills", () => {
    expect(matchCategory(catalogs, "Utilities")?.id).toBe("u");
  });
});
