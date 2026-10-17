import { describe, expect, it } from "vitest";
import {
  cumulativeDaily,
  dailyFromRows,
  daysSoFar,
  monthTotals,
  monthsBack,
  spendByPaymentMethod,
  spendThisWeek,
} from "./reports";
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

describe("chart helpers", () => {
  it("lists months oldest first, across a year end", () => {
    expect(monthsBack("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("totals days into the requested months only", () => {
    const days = new Map([
      ["2026-09-03", 100],
      ["2026-09-30", 50],
      ["2026-10-01", 20],
      ["2026-07-15", 999],
    ]);
    expect(monthTotals(days, ["2026-08", "2026-09", "2026-10"])).toEqual([
      { month: "2026-08", total: 0 },
      { month: "2026-09", total: 150 },
      { month: "2026-10", total: 20 },
    ]);
  });

  it("builds a running total per day", () => {
    const days = dailyFromRows([tx("a", 54, "2026-10-01"), tx("b", 46, "2026-10-01"), tx("c", 400, "2026-10-03")]);
    expect(cumulativeDaily(days, "2026-10", 4)).toEqual([100, 100, 500, 500]);
    expect(cumulativeDaily(days, "2026-10")).toHaveLength(31);
  });

  it("counts the days of a month that have happened", () => {
    expect(daysSoFar("2026-10", "2026-10-17")).toBe(17);
    expect(daysSoFar("2026-09", "2026-10-17")).toBe(30);
    expect(daysSoFar("2026-11", "2026-10-17")).toBe(0);
  });

  it("splits spend by payment method, unset last when smallest", () => {
    const upi = { id: "upi", household_id: null, name: "UPI", sort_order: 1, is_system: true };
    const rows = [
      { ...tx("a", 300, "2026-10-01"), payment_method: upi },
      { ...tx("b", 100, "2026-10-02"), payment_method: upi },
      tx("c", 100, "2026-10-02"),
    ];
    expect(spendByPaymentMethod(rows)).toEqual([
      { id: "upi", name: "UPI", total: 400, percent: 80 },
      { id: "none", name: "Not set", total: 100, percent: 20 },
    ]);
  });
});
