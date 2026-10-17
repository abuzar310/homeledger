import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { budgetPace, budgetProgress, upsertMonthBudget } from "./budgets";
import type { Budget } from "./types";

describe("budgetProgress", () => {
  it("reports remaining and percent", () => {
    expect(budgetProgress(6420, 10000)).toEqual({ percent: 64, remaining: 3580, over: false });
  });

  it("does not go below zero remaining", () => {
    expect(budgetProgress(12000, 10000)).toEqual({ percent: 100, remaining: 0, over: true });
  });
});

function fakeClient() {
  const calls: { op: string; values: unknown; id?: string }[] = [];
  const client = {
    from: () => ({
      insert: async (values: unknown) => {
        calls.push({ op: "insert", values });
        return { error: null };
      },
      update: (values: unknown) => ({
        eq: async (_col: string, id: string) => {
          calls.push({ op: "update", values, id });
          return { error: null };
        },
      }),
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const row = (id: string, category_id: string | null): Budget => ({
  id,
  household_id: "h1",
  category_id,
  year_month: "2026-10-01",
  amount: 5000,
});

describe("upsertMonthBudget", () => {
  it("updates the existing category budget instead of inserting a duplicate", async () => {
    const { client, calls } = fakeClient();
    await upsertMonthBudget(client, "h1", "2026-10", 7000, "food", [row("b1", null), row("b2", "food")]);
    expect(calls).toEqual([{ op: "update", values: { amount: 7000 }, id: "b2" }]);
  });

  it("updates the existing whole-household budget", async () => {
    const { client, calls } = fakeClient();
    await upsertMonthBudget(client, "h1", "2026-10", 20000, null, [row("b1", null), row("b2", "food")]);
    expect(calls).toEqual([{ op: "update", values: { amount: 20000 }, id: "b1" }]);
  });

  it("inserts when the month has no budget for that category", async () => {
    const { client, calls } = fakeClient();
    await upsertMonthBudget(client, "h1", "2026-10", 3000, "fuel", [row("b2", "food")]);
    expect(calls).toEqual([
      { op: "insert", values: { household_id: "h1", category_id: "fuel", year_month: "2026-10-01", amount: 3000 } },
    ]);
  });
});

describe("budgetPace", () => {
  it("warns on the day the budget runs out at this rate", () => {
    // ₹12,000 spent by 10 Oct is ₹1,200 a day; ₹20,000 lasts until the 17th.
    expect(budgetPace(12000, 20000, "2026-10", "2026-10-10")).toEqual({ elapsedPercent: 32, projected: 37200, crossDay: 17 });
  });

  it("stays calm when spending is on track", () => {
    expect(budgetPace(5000, 20000, "2026-10", "2026-10-15")).toEqual({ elapsedPercent: 48, projected: 10333, crossDay: null });
  });

  it("has no pace for a month that is not in progress", () => {
    expect(budgetPace(5000, 20000, "2026-09", "2026-10-15")).toBeNull();
    expect(budgetPace(5000, 0, "2026-10", "2026-10-15")).toBeNull();
  });
});
