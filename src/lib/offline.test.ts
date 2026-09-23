import { describe, expect, it, beforeEach } from "vitest";
import { clearOfflineQueue, enqueueOffline, readOfflineQueue } from "./offline";

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

describe("offline queue", () => {
  beforeEach(() => {
    clearOfflineQueue();
  });

  it("stores an expense until it can sync", () => {
    enqueueOffline({
      name: "Milk",
      amount: 54,
      occurredOn: "2026-09-23",
      clientRequestId: "11111111-1111-1111-1111-111111111111",
    });
    expect(readOfflineQueue()).toHaveLength(1);
    expect(readOfflineQueue()[0].name).toBe("Milk");
  });
});
