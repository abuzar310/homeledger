import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { sanitizeSearchTerm, updateExpense } from "./transactions";

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
