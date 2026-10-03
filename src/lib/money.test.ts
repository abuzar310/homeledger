import { describe, expect, it } from "vitest";
import { formatINR, monthChangeCopy, parseAmount, percentChange } from "./money";

describe("money", () => {
  it("formats Indian rupees", () => {
    expect(formatINR(1299)).toBe("₹1,299");
    expect(formatINR(54)).toBe("₹54");
    expect(formatINR(33880)).toBe("₹33,880");
  });

  it("parses amounts", () => {
    expect(parseAmount("54")).toBe(54);
    expect(parseAmount("₹2,499")).toBe(2499);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-3")).toBeNull();
  });

  it("compares months", () => {
    expect(percentChange(33880, 28420)).toBe(19);
    expect(percentChange(100, 0)).toBe(100);
    expect(monthChangeCopy(42262, 63077)).toBe("33% less than last month");
    expect(monthChangeCopy(33880, 28420)).toBe("19% more than last month");
    expect(monthChangeCopy(0, 0)).toBeNull();
  });
});
