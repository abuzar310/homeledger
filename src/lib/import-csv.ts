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
};

export function parseExpenseCsv(text: string): ImportedExpense[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const out: ImportedExpense[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsv(line);
    const amount = parseAmount(cols[idx("amount")] ?? "");
    const name = (cols[idx("name")] ?? "").trim();
    const occurredOn = (cols[idx("date")] ?? "").trim();
    if (!name || amount == null || !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) continue;
    out.push({
      name,
      amount,
      occurredOn,
      categoryName: cols[idx("category")] ?? "",
      subcategoryName: cols[idx("subcategory")] ?? "",
      merchantName: cols[idx("merchant")] ?? "",
      paymentMethodName: cols[idx("payment method")] ?? "",
      notes: cols[idx("notes")] ?? "",
    });
  }
  return out;
}

function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
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
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}
