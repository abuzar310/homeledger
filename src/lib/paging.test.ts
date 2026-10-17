import { describe, expect, it } from "vitest";
import { allPages } from "./paging";

describe("allPages", () => {
  it("keeps asking until a page comes back short", async () => {
    const asked: [number, number][] = [];
    const rows = await allPages(async (from, to) => {
      asked.push([from, to]);
      const size = from < 2000 ? 1000 : 5;
      return { data: Array.from({ length: size }, (_, i) => from + i), error: null };
    });
    expect(rows).toHaveLength(2005);
    expect(asked).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stops on an error", async () => {
    await expect(allPages(async () => ({ data: null, error: new Error("offline") }))).rejects.toThrow("offline");
  });
});
