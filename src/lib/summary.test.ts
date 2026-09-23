import { describe, expect, it } from "vitest";
import { humanMonthSummary } from "./summary";

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
