import { describe, expect, it } from "vitest";
import { sanitizeSearchTerm } from "./transactions";

describe("sanitizeSearchTerm", () => {
  it("keeps a normal search", () => {
    expect(sanitizeSearchTerm("Milk 54")).toBe("Milk 54");
  });

  it("strips PostgREST filter characters", () => {
    expect(sanitizeSearchTerm("milk (1L), 2*")).toBe("milk 1L 2");
  });
});
