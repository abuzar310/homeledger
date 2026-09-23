import { describe, expect, it } from "vitest";
import { parseSmartEntry } from "./smart-entry";

describe("parseSmartEntry", () => {
  it("reads Milk 54", () => {
    expect(parseSmartEntry("Milk 54")).toMatchObject({ name: "Milk", amount: 54 });
  });

  it("reads Nandini milk ₹54 UPI", () => {
    const draft = parseSmartEntry("Nandini milk ₹54 UPI");
    expect(draft.amount).toBe(54);
    expect(draft.paymentHint).toBe("UPI");
    expect(draft.name.toLowerCase()).toContain("milk");
  });

  it("reads Spent 450 on groceries", () => {
    const draft = parseSmartEntry("Spent 450 on groceries");
    expect(draft.amount).toBe(450);
    expect(draft.name.toLowerCase()).toContain("groceries");
  });
});
