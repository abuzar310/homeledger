import { describe, expect, it } from "vitest";
import { formatINR, formatINRCompact, monthChangeCopy, parseAmount, percentChange } from "./money";

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

  it("shortens amounts for chart labels in Indian units", () => {
    expect(formatINRCompact(540)).toBe("₹540");
    expect(formatINRCompact(1250)).toBe("₹1.3K");
    expect(formatINRCompact(12400)).toBe("₹12K");
    expect(formatINRCompact(99_499)).toBe("₹99K");
    expect(formatINRCompact(99_500)).toBe("₹1L");
    expect(formatINRCompact(1_20_000)).toBe("₹1.2L");
    expect(formatINRCompact(2_50_00_000)).toBe("₹2.5Cr");
  });
});
