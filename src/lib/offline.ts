import type { SaveExpenseInput } from "@/lib/transactions";

const KEY = "hl-offline-queue";

export function readOfflineQueue(): SaveExpenseInput[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as SaveExpenseInput[];
  } catch {
    return [];
  }
}

export function enqueueOffline(input: SaveExpenseInput) {
  const next = [...readOfflineQueue(), input];
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearOfflineQueue() {
  localStorage.removeItem(KEY);
}

export function replaceOfflineQueue(rows: SaveExpenseInput[]) {
  if (!rows.length) {
    clearOfflineQueue();
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(rows));
}
