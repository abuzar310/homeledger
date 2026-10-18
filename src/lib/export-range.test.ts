import { describe, expect, it } from "vitest";
import { financialYearStart, financialYearTag, isISODay, resolveExportRange, type RangeInput } from "./export-range";

const base: RangeInput = { kind: "month", month: "2026-10", customFrom: "", customTo: "", today: "2026-10-18" };

describe("financial year", () => {
  it("runs 1 April to 31 March", () => {
    expect(financialYearStart("2026-04-01")).toBe(2026);
    expect(financialYearStart("2026-10-18")).toBe(2026);
    expect(financialYearStart("2027-03-31")).toBe(2026);
    expect(financialYearStart("2026-01-15")).toBe(2025);
  });

  it("names the year the Indian way", () => {
    expect(financialYearTag(2026)).toBe("FY2026-27");
    expect(financialYearTag(2099)).toBe("FY2099-00");
    expect(financialYearTag(2008)).toBe("FY2008-09");
  });
});

describe("isISODay", () => {
  it("accepts real calendar days only", () => {
    expect(isISODay("2028-02-29")).toBe(true);
    expect(isISODay("2027-02-29")).toBe(false);
    expect(isISODay("2026-13-01")).toBe(false);
    expect(isISODay("18-10-2026")).toBe(false);
    expect(isISODay("")).toBe(false);
  });
});

describe("resolveExportRange", () => {
  it("covers the picked month, as before", () => {
    expect(resolveExportRange(base)).toEqual({ from: "2026-10-01", to: "2026-10-31", label: "October 2026", fileTag: "2026-10" });
    expect(resolveExportRange({ ...base, month: "2028-02" })).toMatchObject({ from: "2028-02-01", to: "2028-02-29" });
    expect(resolveExportRange({ ...base, month: "" })).toEqual({ error: "Pick a month." });
  });

  it("covers this year from 1 January to today", () => {
    expect(resolveExportRange({ ...base, kind: "year" })).toEqual({
      from: "2026-01-01",
      to: "2026-10-18",
      label: "1 Jan 2026 – 18 Oct 2026",
      fileTag: "2026-01-01_to_2026-10-18",
    });
    expect(resolveExportRange({ ...base, kind: "year", today: "2026-01-01" })).toMatchObject({
      from: "2026-01-01",
      to: "2026-01-01",
      fileTag: "2026-01-01",
    });
  });

  it("covers the whole financial year that contains today", () => {
    expect(resolveExportRange({ ...base, kind: "fy" })).toEqual({
      from: "2026-04-01",
      to: "2027-03-31",
      label: "FY 2026-27 (1 Apr 2026 – 31 Mar 2027)",
      fileTag: "FY2026-27",
    });
    expect(resolveExportRange({ ...base, kind: "fy", today: "2027-03-31" })).toMatchObject({ fileTag: "FY2026-27" });
    expect(resolveExportRange({ ...base, kind: "fy", today: "2026-03-31" })).toMatchObject({
      from: "2025-04-01",
      to: "2026-03-31",
      fileTag: "FY2025-26",
    });
  });

  it("uses the custom dates and names the file after them", () => {
    expect(resolveExportRange({ ...base, kind: "custom", customFrom: "2026-04-01", customTo: "2027-03-31" })).toEqual({
      from: "2026-04-01",
      to: "2027-03-31",
      label: "1 Apr 2026 – 31 Mar 2027",
      fileTag: "2026-04-01_to_2027-03-31",
    });
    expect(resolveExportRange({ ...base, kind: "custom", customFrom: "2026-10-05", customTo: "2026-10-05" })).toMatchObject({
      fileTag: "2026-10-05",
      label: "5 Oct 2026",
    });
  });

  it("explains a custom range it cannot use", () => {
    const custom = { ...base, kind: "custom" as const };
    expect(resolveExportRange({ ...custom, customFrom: "2026-10-01" })).toEqual({ error: "Pick a start and an end date." });
    expect(resolveExportRange({ ...custom, customFrom: "2026-10-09", customTo: "2026-10-01" })).toEqual({
      error: "The start date is after the end date.",
    });
    expect(resolveExportRange({ ...custom, customFrom: "2026-02-30", customTo: "2026-03-01" })).toEqual({ error: "Pick valid dates." });
  });
});
