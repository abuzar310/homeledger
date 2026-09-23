import { describe, expect, it } from "vitest";
import { parseExpenseCsv } from "./import-csv";

describe("parseExpenseCsv", () => {
  it("reads the export header", () => {
    const rows = parseExpenseCsv(
      "Date,Name,Amount,Category,Subcategory,Merchant,Payment method,Channel,Notes\n2026-09-23,Milk,54,Groceries,Dairy,Nandini,UPI,,",
    );
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
      },
    ]);
  });
});
