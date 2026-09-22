import { describe, expect, it } from "vitest";
import { transactionsToCsv } from "./export";
import type { Transaction } from "./types";

const sample = {
  id: "1",
  household_id: "h",
  member_id: null,
  created_by: null,
  name: "Nandini Milk",
  amount: 54,
  occurred_on: "2026-09-22",
  category_id: null,
  subcategory_id: null,
  merchant_id: null,
  payment_method_id: null,
  purchase_channel: null,
  notes: null,
  needs_review: false,
  categorization_source: "rule",
  categorization_confidence: 0.9,
  client_request_id: null,
  created_at: "",
  updated_at: "",
  category: { id: "g", household_id: null, name: "Groceries", group_name: "Food", color: "", sort_order: 1, is_system: true },
} as Transaction;

describe("export", () => {
  it("includes rupee amounts and names in CSV", () => {
    const csv = transactionsToCsv([sample]);
    expect(csv).toContain("Nandini Milk");
    expect(csv).toContain("54.00");
    expect(csv).toContain("Groceries");
  });
});
