import { formatINR } from "@/lib/money";
import { CHANNEL_LABELS } from "@/lib/types";
import type { Transaction } from "@/lib/types";

export function transactionsToCsv(rows: Transaction[]): string {
  const header = [
    "Date",
    "Name",
    "Amount",
    "Category",
    "Subcategory",
    "Merchant",
    "Payment method",
    "Channel",
    "Notes",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.occurred_on,
        csv(row.name),
        row.amount.toFixed(2),
        csv(row.category?.name ?? ""),
        csv(row.subcategory?.name ?? ""),
        csv(row.merchant?.name ?? ""),
        csv(row.payment_method?.name ?? ""),
        csv(row.purchase_channel ? CHANNEL_LABELS[row.purchase_channel] : ""),
        csv(row.notes ?? ""),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\n")}`;
}

export function transactionsToExcelXml(rows: Transaction[]): string {
  const cells = (values: string[]) =>
    values.map((value) => `<Cell><Data ss:Type="String">${xml(value)}</Data></Cell>`).join("");
  const header = cells([
    "Date",
    "Name",
    "Amount",
    "Category",
    "Subcategory",
    "Merchant",
    "Payment method",
    "Channel",
    "Notes",
  ]);
  const body = rows
    .map(
      (row) =>
        `<Row>${cells([
          row.occurred_on,
          row.name,
          String(row.amount),
          row.category?.name ?? "",
          row.subcategory?.name ?? "",
          row.merchant?.name ?? "",
          row.payment_method?.name ?? "",
          row.purchase_channel ? CHANNEL_LABELS[row.purchase_channel] : "",
          row.notes ?? "",
        ])}</Row>`,
    )
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Expenses"><Table>
<Row>${header}</Row>
${body}
</Table></Worksheet>
</Workbook>`;
}

export function transactionsToPdf(rows: Transaction[], title: string): Uint8Array {
  const lines = [
    title,
    `Expenses: ${rows.length}`,
    `Total: ${formatINR(rows.reduce((s, r) => s + r.amount, 0))}`,
    "",
    ...rows.slice(0, 40).map((row) => `${row.occurred_on}  ${row.name}  ${formatINR(row.amount)}`),
  ];
  if (rows.length > 40) lines.push(`…and ${rows.length - 40} more`);
  return buildSimplePdf(lines);
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildSimplePdf(lines: string[]): Uint8Array {
  const escaped = lines.map((line) =>
    line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)"),
  );
  const content = [`BT /F1 12 Tf 50 780 Td`, ...escaped.map((line, i) => `${i === 0 ? "" : "0 -18 Td "}(${line}) Tj`)].join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let offset = 9;
  const offsets = [0];
  let body = "";
  for (const obj of objects) {
    offsets.push(offset);
    body += `${obj}\n`;
    offset += obj.length + 1;
  }
  const xref = `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n `)
    .join("\n")}\n`;
  const pdf = `%PDF-1.4\n${body}${xref}trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function downloadBlob(filename: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
