import { describe, expect, it } from "vitest";
import { humanMonthSummary, lastMonthLine } from "./summary";

describe("humanMonthSummary", () => {
  it("writes a plain household sentence", () => {
    const text = humanMonthSummary({
      month: "2026-09",
      total: 24680,
      count: 47,
      previous: 21480,
      topCategory: "Groceries",
      largestName: "Electricity",
      largestAmount: 2800,
    });
    expect(text).toContain("September");
    expect(text).toContain("47 expenses");
    expect(text).toContain("Groceries");
    expect(text).toContain("Electricity");
  });
});

describe("lastMonthLine", () => {
  it("compares with the month before and names the top category", () => {
    expect(lastMonthLine({ month: "2026-09", total: 42300, before: 48000, topCategory: "Groceries" })).toBe(
      "You spent ₹42,300 in September, 12% less than August. Most went to Groceries.",
    );
  });

  it("skips the comparison when there is nothing to compare with", () => {
    expect(lastMonthLine({ month: "2026-01", total: 1200, before: 0 })).toBe("You spent ₹1,200 in January.");
  });
});
