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

  it("uses the last number when a name also has digits", () => {
    expect(parseSmartEntry("iPhone 15 1200").amount).toBe(1200);
  });
});

describe("parseSmartEntry with grouped amounts", () => {
  it("reads Rent 12,000", () => {
    expect(parseSmartEntry("Rent 12,000")).toMatchObject({ name: "Rent", amount: 12000 });
  });

  it("reads Indian grouping", () => {
    expect(parseSmartEntry("School fees 1,20,000").amount).toBe(120000);
    expect(parseSmartEntry("Car 12,34,567").amount).toBe(1234567);
  });

  it("reads international grouping", () => {
    expect(parseSmartEntry("Laptop 1,200,000").amount).toBe(1200000);
  });

  it("reads a marked amount with paise", () => {
    const draft = parseSmartEntry("Dinner ₹1,200.50 UPI");
    expect(draft.amount).toBe(1200.5);
    expect(draft.paymentHint).toBe("UPI");
    expect(draft.name).toBe("Dinner");
  });

  it("still uses the last number with grouping", () => {
    expect(parseSmartEntry("iPhone 15 1,20,000").amount).toBe(120000);
  });

  it("does not join numbers that are only separated by a comma and space", () => {
    expect(parseSmartEntry("Milk 2, eggs 60").amount).toBe(60);
  });
});
