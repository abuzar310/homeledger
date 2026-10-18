import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { attachReceipt, deleteReceipts, latestReceipt, receiptExtension, receiptPath, replaceReceipt } from "./receipts";
import type { Receipt } from "./types";

type Fail = Partial<Record<"upload" | "insert" | "remove" | "delete", boolean>>;

/** Records the storage and table calls the receipt helpers make; `fail` makes one of them error. */
function fakeClient(fail: Fail = {}) {
  const calls: { op: string; args: unknown[] }[] = [];
  const result = (op: keyof Fail) => ({ data: null, error: fail[op] ? new Error(op) : null });
  const client = {
    storage: {
      from(bucket: string) {
        return {
          upload(...args: unknown[]) {
            calls.push({ op: "upload", args: [bucket, ...args] });
            return Promise.resolve(result("upload"));
          },
          remove(...args: unknown[]) {
            calls.push({ op: "remove", args: [bucket, ...args] });
            return Promise.resolve(result("remove"));
          },
        };
      },
    },
    from(table: string) {
      return {
        insert(values: unknown) {
          calls.push({ op: "insert", args: [table, values] });
          return Promise.resolve(result("insert"));
        },
        delete() {
          return {
            in(column: string, values: unknown) {
              calls.push({ op: "delete", args: [table, column, values] });
              return Promise.resolve(result("delete"));
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const photo = new File(["x"], "bill.jpg", { type: "image/jpeg" });

function receipt(id: string, created_at: string): Receipt {
  return { id, household_id: "h1", transaction_id: "t1", storage_path: `h1/t1/${id}.jpg`, file_name: `${id}.jpg`, created_at };
}

describe("receipt paths", () => {
  it("keeps the household folder first and picks a safe extension", () => {
    expect(receiptPath("h1", "t1", "u1", "image/jpeg")).toBe("h1/t1/u1.jpg");
    expect(receiptPath("h1", "t1", "u1", "image/png")).toBe("h1/t1/u1.png");
    expect(receiptExtension("image/svg+xml")).toBe("svgxml");
    expect(receiptExtension("")).toBe("jpg");
    expect(receiptExtension("application/pdf")).toBe("jpg");
  });

  it("shows the newest receipt when an expense has more than one", () => {
    expect(latestReceipt([])).toBeNull();
    expect(latestReceipt(undefined)).toBeNull();
    const older = receipt("a", "2026-10-01T10:00:00+00:00");
    const newer = receipt("b", "2026-10-02T09:00:00+00:00");
    expect(latestReceipt([newer, older])?.id).toBe("b");
    expect(latestReceipt([older, newer])?.id).toBe("b");
  });
});

describe("attachReceipt", () => {
  it("uploads to a fresh path without overwriting, then links the row", async () => {
    const { client, calls } = fakeClient();
    await attachReceipt(client, "h1", "t1", photo);
    expect(calls.map((c) => c.op)).toEqual(["upload", "insert"]);
    const [bucket, path, , options] = calls[0].args as [string, string, File, { upsert: boolean; contentType: string }];
    expect(bucket).toBe("receipts");
    expect(path).toMatch(/^h1\/t1\/[0-9a-f-]{36}\.jpg$/);
    expect(options).toEqual({ upsert: false, contentType: "image/jpeg" });
    expect(calls[1].args[1]).toEqual({ household_id: "h1", transaction_id: "t1", storage_path: path, file_name: "bill.jpg" });
  });

  it("uses a new path every time", async () => {
    const { client, calls } = fakeClient();
    await attachReceipt(client, "h1", "t1", photo);
    await attachReceipt(client, "h1", "t1", photo);
    const paths = calls.filter((c) => c.op === "upload").map((c) => c.args[1]);
    expect(new Set(paths).size).toBe(2);
  });

  it("removes the uploaded file again when the row cannot be saved", async () => {
    const { client, calls } = fakeClient({ insert: true });
    await expect(attachReceipt(client, "h1", "t1", photo)).rejects.toThrow("insert");
    expect(calls.map((c) => c.op)).toEqual(["upload", "insert", "remove"]);
    expect(calls[2].args[1]).toEqual([calls[0].args[1]]);
  });

  it("stops before linking when the upload fails", async () => {
    const { client, calls } = fakeClient({ upload: true });
    await expect(attachReceipt(client, "h1", "t1", photo)).rejects.toThrow("upload");
    expect(calls.map((c) => c.op)).toEqual(["upload"]);
  });
});

describe("deleteReceipts", () => {
  const old = [receipt("a", "2026-10-01T10:00:00+00:00")];

  it("removes the stored photo, then the row", async () => {
    const { client, calls } = fakeClient();
    await deleteReceipts(client, old);
    expect(calls).toEqual([
      { op: "remove", args: ["receipts", ["h1/t1/a.jpg"]] },
      { op: "delete", args: ["receipts", "id", ["a"]] },
    ]);
  });

  it("keeps the row when the photo could not be removed, so it can be retried", async () => {
    const { client, calls } = fakeClient({ remove: true });
    await expect(deleteReceipts(client, old)).rejects.toThrow("remove");
    expect(calls.map((c) => c.op)).toEqual(["remove"]);
  });

  it("does nothing for an expense without receipts", async () => {
    const { client, calls } = fakeClient();
    await deleteReceipts(client, []);
    expect(calls).toEqual([]);
  });
});

describe("replaceReceipt", () => {
  const old = [receipt("a", "2026-10-01T10:00:00+00:00")];

  it("adds the new photo before removing the old one", async () => {
    const { client, calls } = fakeClient();
    expect(await replaceReceipt(client, "h1", "t1", photo, old)).toEqual({ oldRemoved: true });
    expect(calls.map((c) => c.op)).toEqual(["upload", "insert", "remove", "delete"]);
  });

  it("keeps the new photo when the old one cannot be removed", async () => {
    const { client } = fakeClient({ delete: true });
    expect(await replaceReceipt(client, "h1", "t1", photo, old)).toEqual({ oldRemoved: false });
  });

  it("leaves the old photo alone when the new one fails", async () => {
    const { client, calls } = fakeClient({ upload: true });
    await expect(replaceReceipt(client, "h1", "t1", photo, old)).rejects.toThrow("upload");
    expect(calls.map((c) => c.op)).toEqual(["upload"]);
  });
});
