import { describe, expect, it } from "vitest";
import { pickActiveHouseholdId } from "./household";

describe("pickActiveHouseholdId", () => {
  it("uses the newest membership after a join", () => {
    expect(
      pickActiveHouseholdId("old-home", [
        { household_id: "old-home", created_at: "2026-01-01T00:00:00Z" },
        { household_id: "family-home", created_at: "2026-09-24T00:00:00Z" },
      ]),
    ).toBe("family-home");
  });

  it("falls back to the ensured id", () => {
    expect(pickActiveHouseholdId("solo", [])).toBe("solo");
  });
});
