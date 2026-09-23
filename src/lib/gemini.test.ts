import { describe, expect, it } from "vitest";
import { parseModelJson, toCategorizeResult, toInsightText, toReceiptDraft } from "./gemini";

describe("gemini json helpers", () => {
  it("pulls JSON out of a fenced model reply", () => {
    const parsed = parseModelJson<{ categoryName: string }>(
      'Sure.\n```json\n{"categoryName":"Transport"}\n```',
    );
    expect(parsed?.categoryName).toBe("Transport");
  });

  it("maps a Gemini category payload", () => {
    const result = toCategorizeResult({
      categoryName: "Transport",
      subcategoryName: "Fuel",
      merchantName: "HP",
      purchaseChannel: "store",
      confidence: 0.91,
    });
    expect(result).toMatchObject({
      categoryName: "Transport",
      subcategoryName: "Fuel",
      source: "ai",
      needsReview: false,
    });
  });

  it("drops empty category replies", () => {
    expect(toCategorizeResult({ categoryName: null, confidence: 0.9 })).toBeNull();
  });

  it("keeps a usable receipt total and date", () => {
    const draft = toReceiptDraft({
      name: "Milk",
      amount: 54.4,
      occurredOn: "2026-09-21",
      merchantName: "Nandini",
    });
    expect(draft).toEqual({
      name: "Milk",
      amount: 54,
      occurredOn: "2026-09-21",
      merchantName: "Nandini",
      notes: null,
      categoryName: null,
      subcategoryName: null,
      paymentMethodName: null,
    });
  });

  it("caps the home insight", () => {
    const long = "x".repeat(200);
    const capped = toInsightText({ text: long });
    expect(capped?.endsWith("…")).toBe(true);
    expect((capped?.length ?? 0) <= 180).toBe(true);
    expect(toInsightText({ text: "  " })).toBeNull();
  });
});
