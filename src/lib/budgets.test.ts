import { describe, expect, it } from "vitest";
import { budgetProgress } from "./budgets";

describe("budgetProgress", () => {
  it("reports remaining and percent", () => {
    expect(budgetProgress(6420, 10000)).toEqual({ percent: 64, remaining: 3580, over: false });
  });

  it("does not go below zero remaining", () => {
    expect(budgetProgress(12000, 10000)).toEqual({ percent: 100, remaining: 0, over: true });
  });
});
