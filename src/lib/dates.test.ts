import { describe, expect, it } from "vitest";
import { formatMonthLabel, monthEnd, monthStart, previousMonth } from "./dates";

describe("dates", () => {
  it("builds month bounds", () => {
    expect(monthStart("2026-09")).toBe("2026-09-01");
    expect(monthEnd("2026-09")).toBe("2026-09-30");
    expect(previousMonth("2026-09")).toBe("2026-08");
    expect(formatMonthLabel("2026-09")).toBe("September 2026");
  });
});
