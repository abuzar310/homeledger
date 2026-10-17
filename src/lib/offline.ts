import type { SaveExpenseInput } from "@/lib/transactions";

const KEY = "hl-offline-queue";

export type OfflineOwner = { userId: string; householdId: string };

// Entries queued before owners were stored have no userId/householdId.
export type QueuedExpense = SaveExpenseInput & Partial<OfflineOwner>;

export function readOfflineQueue(): QueuedExpense[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]") as QueuedExpense[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(rows: QueuedExpense[]) {
  try {
    if (!rows.length) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* storage blocked */
  }
}

export function enqueueOffline(input: SaveExpenseInput, owner: OfflineOwner) {
  const rest = readOfflineQueue().filter((row) => row.clientRequestId !== input.clientRequestId);
  writeOfflineQueue([...rest, { ...input, ...owner }]);
}

function belongsTo(row: QueuedExpense, owner: OfflineOwner) {
  return (!row.userId || row.userId === owner.userId) && (!row.householdId || row.householdId === owner.householdId);
}

export function queuedFor(owner: OfflineOwner): QueuedExpense[] {
  return readOfflineQueue().filter((row) => belongsTo(row, owner));
}

export function removeOfflineEntry(clientRequestId: string) {
  writeOfflineQueue(readOfflineQueue().filter((row) => row.clientRequestId !== clientRequestId));
}

export function clearOfflineQueue() {
  writeOfflineQueue([]);
}

/** On sign-out: drop this user's entries (and ownerless legacy ones), keep other people's. */
export function clearOfflineQueueFor(userId: string) {
  writeOfflineQueue(readOfflineQueue().filter((row) => row.userId && row.userId !== userId));
}

const NETWORK_MESSAGE = /failed to fetch|networkerror|load failed|network request failed|fetch failed/i;

/** True when a save failed because the phone could not reach the server, so queuing it is safe. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message =
    err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
  return NETWORK_MESSAGE.test(message);
}

let flushing: Promise<void> | null = null;

/**
 * Saves queued expenses for this user and household one at a time. Only one flush runs at a
 * time, and each saved entry is removed from a fresh read so anything queued meanwhile stays.
 */
export function flushOfflineQueue(owner: OfflineOwner, save: (input: SaveExpenseInput) => Promise<unknown>) {
  if (flushing) return flushing;
  flushing = (async () => {
    const tried = new Set<string>();
    for (;;) {
      const next = queuedFor(owner).find((row) => !tried.has(row.clientRequestId));
      if (!next) return;
      tried.add(next.clientRequestId);
      const input: QueuedExpense = { ...next };
      delete input.userId;
      delete input.householdId;
      try {
        await save(input);
        removeOfflineEntry(next.clientRequestId);
      } catch (err) {
        if (isNetworkError(err)) return;
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
