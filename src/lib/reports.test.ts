import { describe, expect, it } from "vitest";
import { spendThisWeek } from "./reports";
import type { Transaction } from "./types";

function tx(id: string, amount: number, occurred_on: string): Transaction {
  return {
    id,
    household_id: "h",
    member_id: null,
    created_by: null,
    name: id,
    amount,
    occurred_on,
    category_id: null,
    subcategory_id: null,
    merchant_id: null,
    payment_method_id: null,
    purchase_channel: null,
    notes: null,
    needs_review: false,
    categorization_source: "none",
    categorization_confidence: null,
    client_request_id: null,
    created_at: occurred_on,
    updated_at: occurred_on,
  };
}

describe("spendThisWeek", () => {
  it("buckets Mon–Sun totals", () => {
    const rows = [tx("a", 430, "2026-08-27"), tx("b", 215, "2026-08-24"), tx("c", 90, "2026-08-20")];
    const week = spendThisWeek(rows, "2026-08-27");
    expect(week).toHaveLength(7);
    expect(week[0].iso).toBe("2026-08-24");
    expect(week[0].total).toBe(215);
    expect(week[3].iso).toBe("2026-08-27");
    expect(week[3].total).toBe(430);
    expect(week.every((d) => d.iso !== "2026-08-20" || d.total === 0 || d.iso === "2026-08-20")).toBe(true);
    expect(week.find((d) => d.iso === "2026-08-20")).toBeUndefined();
  });
});
