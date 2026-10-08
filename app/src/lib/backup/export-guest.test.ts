import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const syncSpy = vi.hoisted(() => vi.fn(async () => undefined));
const downloads = vi.hoisted(() => ({
  blobs: [] as Blob[],
  names: [] as string[],
}));

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getCachedUserId: () => "44444444-4444-4444-8444-444444444444",
  getCachedSession: () => null,
}));
vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-a",
}));
vi.mock("@/lib/sync", () => ({
  syncEngine: {
    getState: () => ({ updateRequired: false, lastError: null }),
    sync: syncSpy,
    subscribe: () => () => undefined,
  },
}));
vi.mock("@/lib/i18n", () => ({ default: { changeLanguage: async () => {} } }));

vi.stubGlobal("localStorage", {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
});
vi.stubGlobal("navigator", { onLine: true });
vi.stubGlobal("document", {
  createElement: () => {
    const link = {
      href: "",
      download: "",
      click() {
        downloads.names.push(link.download);
      },
    };
    return link;
  },
});
vi.stubGlobal("URL", {
  createObjectURL: (blob: Blob) => {
    downloads.blobs.push(blob);
    return "blob:test";
  },
  revokeObjectURL: () => undefined,
});

import { db } from "@/lib/db";
import { exportDataOnly } from "./export";

describe("exporting the guest data prompt's backup", () => {
  beforeEach(async () => {
    syncSpy.mockClear();
    downloads.blobs.length = 0;
    downloads.names.length = 0;
    await db.activityGroups.clear();
    await db.activityGroups.add({
      id: "g1",
      name: "Guest habits",
      color: null,
      order_index: null,
      is_archived: false,
      archived_at: null,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
      synced_at: null,
      deleted_at: null,
    });
  });

  it("syncs first by default, so an account's backup reflects the cloud", async () => {
    await exportDataOnly();
    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it("does not sync when asked not to, so guest rows are not pushed before the user chooses", async () => {
    await exportDataOnly(undefined, { syncFirst: false });

    expect(syncSpy).not.toHaveBeenCalled();
    expect(downloads.names).toHaveLength(1);
    expect(downloads.blobs[0]!.size).toBeGreaterThan(0);
  });
});
