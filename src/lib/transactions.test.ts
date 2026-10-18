import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { sanitizeSearchTerm, saveExpense, updateExpense } from "./transactions";

describe("sanitizeSearchTerm", () => {
  it("keeps a normal search", () => {
    expect(sanitizeSearchTerm("Milk 54")).toBe("Milk 54");
  });

  it("strips PostgREST filter characters", () => {
    expect(sanitizeSearchTerm("milk (1L), 2*")).toBe("milk 1L 2");
  });
});

describe("updateExpense", () => {
  function fakeSupabase() {
    const updates: Record<string, unknown>[] = [];
    const builder = {
      update(payload: Record<string, unknown>) {
        updates.push(payload);
        return builder;
      },
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: { id: "t1", amount: "10", merchant_id: null, items: [] }, error: null }),
      then(resolve: (value: { error: null }) => void) {
        resolve({ error: null });
      },
    };
    return { client: { from: () => builder } as unknown as SupabaseClient, updates };
  }

  it("keeps an AI guess under review when only the amount changes", async () => {
    const { client, updates } = fakeSupabase();
    await updateExpense(client, "t1", { amount: 120 });
    expect(updates[0]).toEqual({ amount: 120 });
  });

  it("marks the category as the user's when it changes", async () => {
    const { client, updates } = fakeSupabase();
    await updateExpense(client, "t1", { category_id: "c1", subcategory_id: null });
    expect(updates[0]).toMatchObject({ category_id: "c1", categorization_source: "user", needs_review: false });
  });
});

describe("saveExpense", () => {
  type Step = { table: string; op: string };

  function fakeSupabase(insertResult: { data: unknown; error: unknown }) {
    const steps: Step[] = [];
    const client = {
      from(table: string) {
        let op = "select";
        const builder = {
          select: () => builder,
          eq: () => builder,
          insert() {
            op = "insert";
            return builder;
          },
          maybeSingle: async () => {
            steps.push({ table, op: "maybeSingle" });
            return { data: table === "household_members" ? { id: "member-1" } : null, error: null };
          },
          single: async () => {
            steps.push({ table, op: op === "insert" ? "insert" : "single" });
            if (op === "insert") return insertResult;
            return { data: { id: "t-existing", amount: "54", name: "Milk", items: [], receipts: [] }, error: null };
          },
        };
        return builder;
      },
    };
    return { client: client as unknown as SupabaseClient, steps };
  }

  const catalogs = { categories: [], subcategories: [], paymentMethods: [] };
  const input = {
    name: "Milk",
    amount: 54,
    occurredOn: "2026-10-18",
    categoryId: "dairy",
    clientRequestId: "11111111-1111-4111-8111-111111111111",
    userCategorized: true,
  };

  it("saves a hand-categorised expense without a pre-check or the merchant list", async () => {
    const { client, steps } = fakeSupabase({ data: { id: "t-new", amount: "54", name: "Milk" }, error: null });
    const saved = await saveExpense(client, "h1", "u1", catalogs, input);
    expect(saved.id).toBe("t-new");
    expect(steps).toEqual([
      { table: "household_members", op: "maybeSingle" },
      { table: "transactions", op: "insert" },
    ]);
  });

  it("returns the already-saved expense when the same request is sent again", async () => {
    const { client } = fakeSupabase({ data: null, error: { code: "23505", message: "duplicate key" } });
    const saved = await saveExpense(client, "h2", "u2", catalogs, input);
    expect(saved.id).toBe("t-existing");
    expect(saved.amount).toBe(54);
  });
});
