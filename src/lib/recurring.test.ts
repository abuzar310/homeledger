import { describe, expect, it } from "vitest";
import { nextDueOn, nextMonthKey } from "./recurring";

describe("nextDueOn", () => {
  it("keeps this month when the day is still ahead", () => {
    expect(nextDueOn(10, "2026-09-03")).toBe("2026-09-10");
  });

  it("is due today when the day matches", () => {
    expect(nextDueOn(10, "2026-09-10")).toBe("2026-09-10");
  });

  it("rolls to next month after the day", () => {
    expect(nextDueOn(10, "2026-09-23")).toBe("2026-10-10");
  });

  it("advances the month key", () => {
    expect(nextMonthKey("2026-12")).toBe("2027-01");
  });
});
