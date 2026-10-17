import { describe, expect, it } from "vitest";
import { importRequestIds, parseExpenseCsv } from "./import-csv";

const HEADER = "Date,Name,Amount,Category,Subcategory,Merchant,Payment method,Channel,Notes";

describe("parseExpenseCsv", () => {
  it("reads the export header", () => {
    const { rows, skipped } = parseExpenseCsv(`${HEADER}\n2026-09-23,Milk,54,Groceries,Dairy,Nandini,UPI,,`);
    expect(skipped).toBe(0);
    expect(rows).toEqual([
      {
        name: "Milk",
        amount: 54,
        occurredOn: "2026-09-23",
        categoryName: "Groceries",
        subcategoryName: "Dairy",
        merchantName: "Nandini",
        paymentMethodName: "UPI",
        notes: "",
        rowIndex: 0,
      },
    ]);
  });

  it("keeps quoted notes with line breaks, commas and quotes in one row", () => {
    const csv = `﻿${HEADER}\r\n2026-09-23,Milk,54,,,,,,"first line\r\nsecond, with ""quotes"""\r\n2026-09-24,Bread,40,,,,,,\r\n`;
    const { rows, skipped } = parseExpenseCsv(csv);
    expect(skipped).toBe(0);
    expect(rows.map((r) => [r.name, r.notes, r.rowIndex])).toEqual([
      ["Milk", 'first line\r\nsecond, with "quotes"', 0],
      ["Bread", "", 1],
    ]);
  });

  it("counts rows it cannot use and ignores blank lines", () => {
    const csv = `${HEADER}\n2026-09-23,Milk,54\n\n,No name,10\n2026-09-23,Bad amount,abc\n23/09/2026,Bad date,10\n2026-09-25,Tea,20\n`;
    const { rows, skipped } = parseExpenseCsv(csv);
    expect(rows.map((r) => r.name)).toEqual(["Milk", "Tea"]);
    expect(skipped).toBe(3);
    expect(rows.map((r) => r.rowIndex)).toEqual([0, 4]);
  });

  it("removes the apostrophe our export adds to formula-looking text", () => {
    const { rows } = parseExpenseCsv(`${HEADER}\n2026-09-23,'=1+1,54,,,'@shop,,,'-note`);
    expect(rows[0]).toMatchObject({ name: "=1+1", merchantName: "@shop", notes: "-note" });
  });

  it("returns nothing for a header-only file", () => {
    expect(parseExpenseCsv(HEADER)).toEqual({ rows: [], skipped: 0 });
    expect(parseExpenseCsv("")).toEqual({ rows: [], skipped: 0 });
  });
});

describe("importRequestIds", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("gives the same ids when the same file is imported again", async () => {
    const first = await importRequestIds("h1", "file text", [0, 1, 2]);
    const again = await importRequestIds("h1", "file text", [0, 1, 2]);
    expect(again).toEqual(first);
    expect(new Set(first).size).toBe(3);
    for (const id of first) expect(id).toMatch(UUID);
  });

  it("differs by file, row and household", async () => {
    const [base] = await importRequestIds("h1", "file text", [0]);
    expect((await importRequestIds("h1", "other file", [0]))[0]).not.toBe(base);
    expect((await importRequestIds("h1", "file text", [1]))[0]).not.toBe(base);
    expect((await importRequestIds("h2", "file text", [0]))[0]).not.toBe(base);
  });
});
