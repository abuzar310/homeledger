import { describe, expect, it, beforeEach } from "vitest";
import { resetAiAskCache, shouldAskAi } from "./once";

describe("shouldAskAi", () => {
  beforeEach(() => resetAiAskCache());

  it("does not spend the key on a local milk match", () => {
    expect(shouldAskAi("Milk", 0.92)).toBe(false);
  });

  it("asks once for an unknown name", () => {
    expect(shouldAskAi("A4tech K-7", null)).toBe(true);
    expect(shouldAskAi("A4tech K-7", null)).toBe(false);
  });

  it("skips tiny or number-only names", () => {
    expect(shouldAskAi("ab", null)).toBe(false);
    expect(shouldAskAi("54", null)).toBe(false);
  });
});
