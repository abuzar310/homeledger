import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  addCatalogRow,
  catalogNameError,
  cleanCatalogName,
  deleteCatalogRow,
  isOwnRow,
  nextSortOrder,
  updateCatalogRow,
} from "./catalog-edit";

const existing = [
  { id: "1", name: "Groceries" },
  { id: "2", name: "Pet care" },
];

describe("catalog names", () => {
  it("trims and collapses spaces", () => {
    expect(cleanCatalogName("  Pet   care ")).toBe("Pet care");
  });

  it("rejects empty, long, and duplicate names", () => {
    expect(catalogNameError("   ", existing)).toBe("Enter a name.");
    expect(catalogNameError("x".repeat(41), existing)).toMatch(/40 characters/);
    expect(catalogNameError(" groceries ", existing)).toBe("groceries is already in the list.");
    expect(catalogNameError("School fees", existing)).toBeNull();
  });

  it("lets a row keep its own name when renamed", () => {
    expect(catalogNameError("Pet Care", existing, "2")).toBeNull();
    expect(catalogNameError("Pet Care", existing, "1")).not.toBeNull();
  });
});

describe("isOwnRow", () => {
  it("only allows this household's non-system rows", () => {
    expect(isOwnRow({ household_id: null, is_system: true }, "h1")).toBe(false);
    expect(isOwnRow({ household_id: "h1", is_system: true }, "h1")).toBe(false);
    expect(isOwnRow({ household_id: "h2", is_system: false }, "h1")).toBe(false);
    expect(isOwnRow({ household_id: "h1", is_system: false }, null)).toBe(false);
    expect(isOwnRow({ household_id: "h1", is_system: false }, "h1")).toBe(true);
  });
});

describe("nextSortOrder", () => {
  it("goes after the last row", () => {
    expect(nextSortOrder([{ sort_order: 10 }, { sort_order: 120 }])).toBe(130);
    expect(nextSortOrder([])).toBe(10);
  });
});

function fakeClient(result: { data?: unknown[] | null; error?: unknown }) {
  const calls: { op: string; table: string; values?: unknown; filters: [string, unknown][] }[] = [];
  const client = {
    from: (table: string) => {
      const call = { op: "", table, values: undefined as unknown, filters: [] as [string, unknown][] };
      calls.push(call);
      const chain = {
        eq: (col: string, value: unknown) => {
          call.filters.push([col, value]);
          return chain;
        },
        select: async () => ({ data: result.data ?? null, error: result.error ?? null }),
      };
      return {
        insert: async (values: unknown) => {
          Object.assign(call, { op: "insert", values });
          return { error: result.error ?? null };
        },
        update: (values: unknown) => {
          Object.assign(call, { op: "update", values });
          return chain;
        },
        delete: () => {
          call.op = "delete";
          return chain;
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("catalog writes", () => {
  it("adds a row owned by the household and never a system row", async () => {
    const { client, calls } = fakeClient({});
    await addCatalogRow(client, "categories", "h1", { name: "Pets", color: "#3F7D5A", is_system: 1, household_id: "h2" });
    expect(calls[0]).toMatchObject({
      op: "insert",
      table: "categories",
      values: { name: "Pets", household_id: "h1", is_system: false },
    });
  });

  it("scopes updates and deletes to the household's own rows", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "p1" }] });
    await updateCatalogRow(client, "payment_methods", "h1", "p1", { name: "HDFC card" });
    await deleteCatalogRow(client, "payment_methods", "h1", "p1");
    for (const call of calls) {
      expect(call.filters).toEqual([
        ["id", "p1"],
        ["household_id", "h1"],
        ["is_system", false],
      ]);
    }
    expect(calls.map((c) => c.op)).toEqual(["update", "delete"]);
  });

  it("fails when RLS lets nothing change", async () => {
    const { client } = fakeClient({ data: [] });
    await expect(updateCatalogRow(client, "categories", "h1", "c1", { name: "X" })).rejects.toThrow();
    await expect(deleteCatalogRow(client, "categories", "h1", "c1")).rejects.toThrow();
  });

  it("passes database errors on", async () => {
    const { client } = fakeClient({ error: new Error("offline") });
    await expect(addCatalogRow(client, "categories", "h1", { name: "X" })).rejects.toThrow("offline");
  });
});
