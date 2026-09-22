// ponytail: Home/Reports must not pull receipt/item payloads or refetch catalogs every mount
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const txs = read("src/lib/transactions.ts");
const list = txs.slice(txs.indexOf("const TX_LIST_SELECT"), txs.indexOf("export type TransactionFilters"));
if (!list.includes("TX_LIST_SELECT")) throw new Error("missing TX_LIST_SELECT");
if (list.includes("receipts") || list.includes("transaction_items") || list.includes("items:")) {
  throw new Error("list select still pulls receipts/items");
}

const reports = read("src/lib/reports.ts");
if (!reports.includes("monthMemo") || !reports.includes("clearMonthCache")) {
  throw new Error("month query cache missing");
}
if (!reports.includes("if (categoryId) query = query.eq(\"category_id\", categoryId)")) {
  throw new Error("category report still filters in memory");
}

const household = read("src/lib/household.ts");
if (!household.includes("hl-catalogs") || !household.includes("sessionStorage")) {
  throw new Error("catalog cache missing");
}

const login = read("src/app/login/page.tsx");
if (!login.includes("loadGsi()") || !login.includes("gsiReady")) {
  throw new Error("login does not preload GSI");
}

const txPage = read("src/app/(app)/transactions/page.tsx");
if (!txPage.includes('dynamic(() => import("@/components/FilterSheet")')) {
  throw new Error("FilterSheet is not lazy-loaded");
}
if (!txPage.includes("setTimeout(() => setDebouncedQuery(query), 200)")) {
  throw new Error("search is not debounced");
}

const row = read("src/components/TransactionRow.tsx");
if (!row.includes("memo(function TransactionRow")) throw new Error("TransactionRow is not memoized");

console.log("ok: list/month payloads stay slim, catalogs cache, GSI preloads, search debounces");
