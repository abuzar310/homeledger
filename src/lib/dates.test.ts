import { describe, expect, it } from "vitest";
import { formatMonthLabel, formatWeekRange, monthEnd, monthStart, previousMonth, startOfWeek, weekDays } from "./dates";

describe("dates", () => {
  it("builds month bounds", () => {
    expect(monthStart("2026-09")).toBe("2026-09-01");
    expect(monthEnd("2026-09")).toBe("2026-09-30");
    expect(previousMonth("2026-09")).toBe("2026-08");
    expect(formatMonthLabel("2026-09")).toBe("September 2026");
  });

  it("starts the week on Monday", () => {
    expect(startOfWeek("2026-08-27")).toBe("2026-08-24");
    expect(weekDays("2026-08-24")).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ]);
    expect(formatWeekRange("2026-08-24", "2026-08-30")).toContain("24");
  });
});
