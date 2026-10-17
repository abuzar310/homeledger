import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps in-app paths", () => {
    expect(safeNextPath("/transactions")).toBe("/transactions");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/home");
    expect(safeNextPath("//evil.example")).toBe("/home");
    expect(safeNextPath("/\\evil")).toBe("/home");
  });
});
