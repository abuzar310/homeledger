import { describe, expect, it } from "vitest";
import { categorizeExpense } from "./index";
import type { Catalogs } from "@/lib/types";

const catalogs: Catalogs = {
  categories: [
    { id: "g", household_id: null, name: "Groceries", group_name: "Food & Groceries", color: "#3F7D5A", sort_order: 1, is_system: true },
    { id: "d", household_id: null, name: "Dining & Food", group_name: "Food & Groceries", color: "#C46A3A", sort_order: 2, is_system: true },
    { id: "s", household_id: null, name: "Shopping", group_name: "Shopping", color: "#3F6B8A", sort_order: 3, is_system: true },
    { id: "u", household_id: null, name: "Utilities", group_name: "Bills & Utilities", color: "#4A6B8C", sort_order: 4, is_system: true },
    { id: "k", household_id: null, name: "Kitchen", group_name: "Home", color: "#6A7F4E", sort_order: 5, is_system: true },
    { id: "o", household_id: null, name: "Other", group_name: "Other", color: "#6B645C", sort_order: 6, is_system: true },
  ],
  subcategories: [
    { id: "gd", household_id: null, category_id: "g", name: "Dairy", sort_order: 1, is_system: true },
    { id: "fd", household_id: null, category_id: "d", name: "Food Delivery", sort_order: 1, is_system: true },
    { id: "os", household_id: null, category_id: "s", name: "Online Shopping", sort_order: 1, is_system: true },
    { id: "el", household_id: null, category_id: "u", name: "Electricity", sort_order: 1, is_system: true },
    { id: "kk", household_id: null, category_id: "k", name: "Kitchen", sort_order: 1, is_system: true },
  ],
  paymentMethods: [],
};

describe("automatic categorisation", () => {
  it("puts milk in groceries/dairy", async () => {
    const result = await categorizeExpense({ name: "Nandini Milk" }, catalogs);
    expect(result.categoryId).toBe("g");
    expect(result.subcategoryId).toBe("gd");
    expect(result.source).toBe("rule");
    expect(result.needsReview).toBe(false);
  });

  it("puts Swiggy biryani in food delivery", async () => {
    const result = await categorizeExpense({ name: "Swiggy biryani" }, catalogs);
    expect(result.categoryId).toBe("d");
    expect(result.subcategoryId).toBe("fd");
    expect(result.purchaseChannel).toBe("food_delivery");
    expect(result.merchantName).toBe("Swiggy");
  });

  it("does not force Amazon kitchen items into shopping", async () => {
    const result = await categorizeExpense({ name: "Amazon Kitchen Rack" }, catalogs);
    expect(result.categoryId).toBe("k");
    expect(result.purchaseChannel).toBe("online");
    expect(result.merchantName).toBe("Amazon");
  });

  it("maps BESCOM to electricity", async () => {
    const result = await categorizeExpense({ name: "BESCOM Electricity" }, catalogs);
    expect(result.categoryId).toBe("u");
    expect(result.subcategoryId).toBe("el");
    expect(result.merchantName).toBe("BESCOM");
  });

  it("marks unknown expenses for review", async () => {
    const result = await categorizeExpense({ name: "xyzzy" }, catalogs);
    expect(result.needsReview).toBe(true);
    expect(result.categoryId).toBe("o");
  });
});
