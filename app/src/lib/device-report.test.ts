import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() {
    return storage.size;
  },
});
vi.stubGlobal("matchMedia", () => ({ matches: false }));

import { db } from "@/lib/db";
import { collectDeviceReport } from "./device-report";

beforeEach(async () => {
  storage.clear();
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe("collectDeviceReport", () => {
  it("shows an empty database next to an intact sync cursor", async () => {
    storage.set("okhabit_last_applied_sync_sequence", "91");
    storage.set("okhabit_last_signed_in_user_id", "66666666-6666-4666");

    const report = JSON.parse(await collectDeviceReport());

    expect(report.journal).toMatchObject({ total: 0, live: 0 });
    expect(report.tables.journalEntries).toBe(0);
    expect(report.syncFlags.okhabit_last_applied_sync_sequence).toBe("91");
    // The account id is cut, never reported whole.
    expect(report.syncFlags.okhabit_last_signed_in_user_id).toBe("66666666...");
  });

  it("separates stored rows from live rows and carries no entry text", async () => {
    await db.table("journalEntries").bulkAdd([
      {
        id: "a",
        entry_date: "2026-10-01",
        text_content: "private",
        deleted_at: null,
      },
      {
        id: "b",
        entry_date: "2026-10-05",
        text_content: "secret",
        deleted_at: null,
      },
      {
        id: "c",
        entry_date: "2026-10-09",
        text_content: "gone",
        deleted_at: "2026-10-10",
      },
    ]);

    const text = await collectDeviceReport();
    const report = JSON.parse(text);

    expect(report.journal).toEqual({
      total: 3,
      live: 2,
      oldest: "2026-10-01",
      newest: "2026-10-05",
    });
    expect(text).not.toMatch(/private|secret/);
  });
});
