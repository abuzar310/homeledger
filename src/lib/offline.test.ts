import { describe, expect, it, beforeEach } from "vitest";
import {
  clearOfflineQueue,
  clearOfflineQueueFor,
  enqueueOffline,
  flushOfflineQueue,
  isNetworkError,
  queuedFor,
  readOfflineQueue,
} from "./offline";
import type { SaveExpenseInput } from "./transactions";

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    },
  });
});

const A = { userId: "user-a", householdId: "home-a" };
const B = { userId: "user-b", householdId: "home-b" };

function expense(id: string, name = "Milk"): SaveExpenseInput {
  return { name, amount: 54, occurredOn: "2026-09-23", clientRequestId: id };
}

describe("offline queue", () => {
  beforeEach(() => {
    clearOfflineQueue();
  });

  it("stores an expense until it can sync", () => {
    enqueueOffline(expense("11111111-1111-1111-1111-111111111111"), A);
    expect(readOfflineQueue()).toHaveLength(1);
    expect(readOfflineQueue()[0].name).toBe("Milk");
    expect(readOfflineQueue()[0].userId).toBe("user-a");
  });

  it("does not queue the same request twice", () => {
    enqueueOffline(expense("r1"), A);
    enqueueOffline(expense("r1"), A);
    expect(readOfflineQueue()).toHaveLength(1);
  });

  it("only hands out entries for the signed-in user and household", () => {
    enqueueOffline(expense("a1"), A);
    enqueueOffline(expense("b1"), B);
    expect(queuedFor(B).map((row) => row.clientRequestId)).toEqual(["b1"]);
  });

  it("treats old entries without an owner as the current user's", () => {
    memory.set("hl-offline-queue", JSON.stringify([expense("old")]));
    expect(queuedFor(A).map((row) => row.clientRequestId)).toEqual(["old"]);
  });

  it("clears only the signing-out user's entries", () => {
    enqueueOffline(expense("a1"), A);
    enqueueOffline(expense("b1"), B);
    clearOfflineQueueFor("user-a");
    expect(readOfflineQueue().map((row) => row.clientRequestId)).toEqual(["b1"]);
  });
});

describe("flushOfflineQueue", () => {
  beforeEach(() => {
    clearOfflineQueue();
  });

  it("saves this user's entries without the owner fields and leaves others", async () => {
    enqueueOffline(expense("a1"), A);
    enqueueOffline(expense("b1"), B);
    const saved: SaveExpenseInput[] = [];
    await flushOfflineQueue(A, async (input) => {
      saved.push(input);
    });
    expect(saved).toEqual([expense("a1")]);
    expect(readOfflineQueue().map((row) => row.clientRequestId)).toEqual(["b1"]);
  });

  it("keeps an expense queued while a flush is running", async () => {
    enqueueOffline(expense("a1"), A);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const saved: string[] = [];
    const run = flushOfflineQueue(A, async (input) => {
      if (input.clientRequestId === "a1") await gate;
      saved.push(input.clientRequestId);
    });
    enqueueOffline(expense("a2"), A);
    release();
    await run;
    expect(saved).toEqual(["a1", "a2"]);
    expect(readOfflineQueue()).toHaveLength(0);
  });

  it("runs one flush at a time", async () => {
    enqueueOffline(expense("a1"), A);
    let calls = 0;
    const save = async () => {
      calls += 1;
      await Promise.resolve();
    };
    await Promise.all([flushOfflineQueue(A, save), flushOfflineQueue(A, save)]);
    expect(calls).toBe(1);
  });

  it("keeps entries that fail and stops on a network error", async () => {
    enqueueOffline(expense("a1"), A);
    enqueueOffline(expense("a2"), A);
    let calls = 0;
    await flushOfflineQueue(A, async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    });
    expect(calls).toBe(1);
    expect(readOfflineQueue()).toHaveLength(2);
  });
});

describe("isNetworkError", () => {
  it("spots fetch failures, including Supabase's wrapped ones", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError({ message: "TypeError: Load failed", code: "" })).toBe(true);
    expect(isNetworkError({ message: "new row violates row-level security policy", code: "42501" })).toBe(false);
    expect(isNetworkError(new Error("Could not load saved expense"))).toBe(false);
  });
});
