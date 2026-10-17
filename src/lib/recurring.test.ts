import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import {
  followingDueOn,
  isValidBillDay,
  markRecurringCreated,
  nextDueOn,
  nextMonthKey,
  occurrenceRequestId,
  ordinal,
  type RecurringExpense,
} from "./recurring";

describe("nextDueOn", () => {
  it("keeps this month when the day is still ahead", () => {
    expect(nextDueOn(10, "2026-09-03")).toBe("2026-09-10");
  });

  it("is due today when the day matches", () => {
    expect(nextDueOn(10, "2026-09-10")).toBe("2026-09-10");
  });

  it("rolls to next month after the day", () => {
    expect(nextDueOn(10, "2026-09-23")).toBe("2026-10-10");
  });

  it("advances the month key", () => {
    expect(nextMonthKey("2026-12")).toBe("2027-01");
  });
});

describe("followingDueOn", () => {
  it("moves October's bill to November even when added in November", () => {
    expect(followingDueOn(10, "2026-10-10")).toBe("2026-11-10");
  });

  it("crosses the year", () => {
    expect(followingDueOn(28, "2026-12-28")).toBe("2027-01-28");
  });
});

describe("ordinal", () => {
  it("uses st, nd, rd and th", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 28].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "28th",
    ]);
  });
});

describe("isValidBillDay", () => {
  it("allows 1 to 28 only", () => {
    expect([0, 1, 28, 29, 31, 10.5, Number.NaN].map(isValidBillDay)).toEqual([
      false,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("occurrenceRequestId", () => {
  const bill = { id: "4a1c2b9e-7d3f-4e21-9b8a-0c5d6e7f8a9b", next_on: "2026-10-10" };

  it("gives the same v5-style UUID for the same bill and due date", async () => {
    const first = await occurrenceRequestId(bill);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await occurrenceRequestId({ ...bill })).toBe(first);
  });

  it("changes with the due date and the bill", async () => {
    const first = await occurrenceRequestId(bill);
    expect(await occurrenceRequestId({ ...bill, next_on: "2026-11-10" })).not.toBe(first);
    expect(await occurrenceRequestId({ ...bill, id: "other" })).not.toBe(first);
  });
});

describe("markRecurringCreated", () => {
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

  const bill: RecurringExpense = {
    id: "bill-1",
    household_id: "home-1",
    name: "Electricity",
    amount: 1800,
    category_id: null,
    payment_method_id: null,
    cadence: "monthly",
    day_of_month: 10,
    next_on: "2026-10-10",
    notes: null,
    last_created_on: null,
  };

  function fakeSupabase(result: { data: { id: string }[] | null; error: unknown }) {
    const calls: { update?: Record<string, unknown>; eq: [string, unknown][] } = { eq: [] };
    const builder = {
      update(payload: Record<string, unknown>) {
        calls.update = payload;
        return builder;
      },
      eq(column: string, value: unknown) {
        calls.eq.push([column, value]);
        return builder;
      },
      select: async () => result,
    };
    return { client: { from: () => builder } as unknown as SupabaseClient, calls };
  }

  it("advances from the bill's due date, only if no one else has", async () => {
    const { client, calls } = fakeSupabase({ data: [{ id: "bill-1" }], error: null });
    await markRecurringCreated(client, "home-1", bill, "2026-11-03");
    expect(calls.update).toEqual({ last_created_on: "2026-11-03", next_on: "2026-11-10" });
    expect(calls.eq).toEqual([
      ["id", "bill-1"],
      ["next_on", "2026-10-10"],
    ]);
  });

  it("throws when the update fails", async () => {
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } });
    await expect(markRecurringCreated(client, "home-1", bill, "2026-11-03")).rejects.toEqual({ message: "boom" });
  });

  it("moves a bill that was only kept on this phone", async () => {
    memory.set("hl-recurring:home-1", JSON.stringify([bill]));
    const { client } = fakeSupabase({ data: [], error: null });
    await markRecurringCreated(client, "home-1", bill, "2026-11-03");
    const [local] = JSON.parse(memory.get("hl-recurring:home-1")!) as RecurringExpense[];
    expect(local.next_on).toBe("2026-11-10");
  });
});
