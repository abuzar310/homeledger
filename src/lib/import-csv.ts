import { parseAmount } from "@/lib/money";

export type ImportedExpense = {
  name: string;
  amount: number;
  occurredOn: string;
  categoryName: string;
  subcategoryName: string;
  merchantName: string;
  paymentMethodName: string;
  notes: string;
  /** Position among the file's data rows; feeds the import's request id. */
  rowIndex: number;
};

export type ImportedCsv = {
  rows: ImportedExpense[];
  /** Data rows without a usable name, amount or YYYY-MM-DD date. */
  skipped: number;
};

export function parseExpenseCsv(text: string): ImportedCsv {
  const records = parseCsvRecords(text.replace(/^﻿/, "")).filter((cells) =>
    cells.some((cell) => cell.trim()),
  );
  if (records.length < 2) return { rows: [], skipped: 0 };
  const headers = records[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const rows: ImportedExpense[] = [];
  let skipped = 0;
  records.slice(1).forEach((cols, rowIndex) => {
    const field = (name: string) => unescapeFormula(cols[idx(name)] ?? "");
    const amount = parseAmount(cols[idx("amount")] ?? "");
    const name = field("name").trim();
    const occurredOn = (cols[idx("date")] ?? "").trim();
    if (!name || amount == null || !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
      skipped += 1;
      return;
    }
    rows.push({
      name,
      amount,
      occurredOn,
      categoryName: field("category"),
      subcategoryName: field("subcategory"),
      merchantName: field("merchant"),
      paymentMethodName: field("payment method"),
      notes: field("notes"),
      rowIndex,
    });
  });
  return { rows, skipped };
}

/**
 * Stable request ids for a file's rows, so retrying the same import after a
 * failure hits saveExpense's client_request_id dedupe instead of adding rows twice.
 * The household id is mixed in because client_request_id is unique across households.
 */
export async function importRequestIds(householdId: string, fileText: string, rowIndexes: number[]): Promise<string[]> {
  const fileHash = toHex(await sha256(fileText));
  return Promise.all(
    rowIndexes.map(async (rowIndex) => toUuid(await sha256(`homeledger-import:${householdId}:${fileHash}:${rowIndex}`))),
  );
}

// Our export prefixes formula-looking text with an apostrophe; take it off again.
function unescapeFormula(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

// RFC 4180-style records: quoted fields may hold commas, doubled quotes and line breaks.
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      cells.push(cur);
      records.push(cells);
      cells = [];
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur || cells.length) {
    cells.push(cur);
    records.push(cells);
  }
  return records;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toUuid(bytes: Uint8Array): string {
  const b = bytes.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x80; // version 8 (custom, hash-derived)
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = toHex(b);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
