import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps in-app paths", () => {
    expect(safeNextPath("/transactions")).toBe("/transactions");
    expect(safeNextPath("/reports?month=2026-09")).toBe("/reports?month=2026-09");
    expect(safeNextPath("/transactions?q=milk&page=2#top")).toBe("/transactions?q=milk&page=2#top");
    expect(safeNextPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
  });

  it("falls back to home for empty input", () => {
    expect(safeNextPath(null)).toBe("/home");
    expect(safeNextPath(undefined)).toBe("/home");
    expect(safeNextPath("")).toBe("/home");
    expect(safeNextPath("home")).toBe("/home");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/home");
    expect(safeNextPath("//evil.example")).toBe("/home");
    expect(safeNextPath("/\\evil")).toBe("/home");
  });

  it("rejects control characters the URL parser would strip", () => {
    // ?next=/%09/evil.com and ?next=/%0A/evil.com as searchParams.get() returns them
    expect(safeNextPath("/\t/evil.com")).toBe("/home");
    expect(safeNextPath("/\n/evil.com")).toBe("/home");
    expect(safeNextPath("/\r/evil.com")).toBe("/home");
    expect(safeNextPath("/\x00/evil.com")).toBe("/home");
    expect(safeNextPath("/\x7f/evil.com")).toBe("/home");
  });

  it("rejects encoded slashes once decoded", () => {
    // ?next=/%2F%2Fevil.com arrives decoded as "///evil.com"
    expect(safeNextPath("///evil.com")).toBe("/home");
    expect(safeNextPath("/%2F/evil.com".replace("%2F", "/"))).toBe("/home");
  });

  it("never leaves the app origin", () => {
    for (const raw of ["/home", "/a/../b", "/@evil.com", "/./evil.com", "/x?next=https://evil.com"]) {
      const out = safeNextPath(raw);
      expect(out.startsWith("/")).toBe(true);
      expect(out.startsWith("//")).toBe(false);
      expect(new URL(out, "https://homeledger.example").origin).toBe("https://homeledger.example");
    }
  });
});
