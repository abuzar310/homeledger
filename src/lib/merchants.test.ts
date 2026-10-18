import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { deleteMerchant, likelyDuplicates, mergeMerchants, merchantNameCheck, renameMerchant } from "./merchants";

type Call = { table: string; op: string; values?: unknown; filters: [string, unknown][] };

/** A chainable fake of the parts of supabase-js these helpers use. */
function fakeClient(rowsBack: unknown[] | null = [{ id: "x" }]) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: "", filters: [] };
      calls.push(call);
      const chain = {
        update(values: unknown) {
          call.op = "update";
          call.values = values;
          return chain;
        },
        delete() {
          call.op = "delete";
          return chain;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return chain;
        },
        select() {
          return Promise.resolve({ data: rowsBack, error: null });
        },
        then(resolve: (v: { error: null }) => void) {
          resolve({ error: null });
        },
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const merchants = [
  { id: "m1", name: "Nandini", normalized_name: "nandini" },
  { id: "m2", name: "Nandini Milk", normalized_name: "nandini milk" },
];

describe("merchantNameCheck", () => {
  it("flags a name another merchant already uses, ignoring case and spaces", () => {
    expect(merchantNameCheck("  NANDINI   milk ", merchants, "m1")).toEqual({ error: null, clash: merchants[1] });
  });

  it("allows keeping its own name and rejects empty names", () => {
    expect(merchantNameCheck("Nandini", merchants, "m1")).toEqual({ error: null, clash: null });
    expect(merchantNameCheck("   ", merchants, "m1").error).toBe("Enter a name.");
  });
});

describe("merchant changes", () => {
  it("renames within the household and stores the normalised name", async () => {
    const { client, calls } = fakeClient();
    await renameMerchant(client, "h1", "m1", "  Nandini   Parlour ");
    expect(calls).toEqual([
      {
        table: "merchants",
        op: "update",
        values: { name: "Nandini Parlour", normalized_name: "nandini parlour" },
        filters: [
          ["id", "m1"],
          ["household_id", "h1"],
        ],
      },
    ]);
  });

  it("moves the expenses first, then removes the merged merchant", async () => {
    const { client, calls } = fakeClient();
    await mergeMerchants(client, "h1", "m2", "m1");
    expect(calls.map((c) => [c.table, c.op, c.filters])).toEqual([
      [
        "transactions",
        "update",
        [
          ["household_id", "h1"],
          ["merchant_id", "m2"],
        ],
      ],
      [
        "merchants",
        "delete",
        [
          ["id", "m2"],
          ["household_id", "h1"],
        ],
      ],
    ]);
    expect(calls[0].values).toEqual({ merchant_id: "m1" });
  });

  it("refuses to merge a merchant into itself", async () => {
    const { client } = fakeClient();
    await expect(mergeMerchants(client, "h1", "m1", "m1")).rejects.toThrow("Pick a different merchant.");
  });

  it("reports when the database changed nothing", async () => {
    const { client } = fakeClient([]);
    await expect(deleteMerchant(client, "h1", "m9")).rejects.toThrow("did not change");
  });
});

describe("likelyDuplicates", () => {
  const m = (id: string, name: string) => ({ id, name });

  it("pairs names that differ only in spacing, punctuation or a longer suffix", () => {
    const list = [m("a", "D-Mart"), m("b", "DMart"), m("c", "Nandini"), m("d", "Nandini Milk Parlour"), m("e", "Swiggy")];
    expect(likelyDuplicates(list).map(([x, y]) => [x.id, y.id])).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("ignores short names that only share a prefix", () => {
    expect(likelyDuplicates([m("a", "Ola"), m("b", "Olas Bakery")])).toEqual([]);
  });
});
