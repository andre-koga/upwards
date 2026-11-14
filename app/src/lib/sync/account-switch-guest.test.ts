import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * On the portrait site a visitor can use the app with no account, so rows exist
 * that no account made. Signing in must not push them as the account's own
 * (nothing queued them) and must not forget the account before they are moved
 * aside: the caller reloads, and the boot-time recovery bundles them.
 */

let safety = {
  pendingOpCount: 0,
  unsyncedRowCount: 0,
  hasUnsyncedData: false,
};
let lastSignedInUserId: string | null = null;
const saveLastSignedInUserId = vi.fn((id: string) => {
  lastSignedInUserId = id;
});

vi.mock("@/lib/app-mode", () => ({ isYouMode: true }));
vi.mock("./clear-local-sync-data", () => ({
  clearLocalSyncData: async () => {},
}));
vi.mock("./unsynced-data", () => ({
  getLocalSyncSafetyStatus: async () => safety,
}));
vi.mock("./index", () => ({ syncEngine: { startAutoSync: vi.fn() } }));
vi.mock("./sync-storage", () => ({
  loadLastSignedInUserId: () => lastSignedInUserId,
  saveLastSignedInUserId: (id: string) => saveLastSignedInUserId(id),
  clearLastSignedInUserId: () => {
    lastSignedInUserId = null;
  },
}));

const { prepareSignedInSession } = await import("./account-switch");

describe("account switch on the portrait site", () => {
  beforeEach(() => {
    saveLastSignedInUserId.mockClear();
    lastSignedInUserId = null;
    safety = { pendingOpCount: 0, unsyncedRowCount: 0, hasUnsyncedData: false };
  });

  it("asks for a reload when a guest signs in with their own rows", async () => {
    safety = { pendingOpCount: 0, unsyncedRowCount: 4, hasUnsyncedData: true };

    expect(await prepareSignedInSession("user-new")).toBe(
      "guest_data_to_adopt"
    );
    expect(saveLastSignedInUserId).not.toHaveBeenCalled();
  });

  it("lets a visitor with nothing of their own sign in as usual", async () => {
    expect(await prepareSignedInSession("user-new")).toBe("ready");
    expect(saveLastSignedInUserId).toHaveBeenCalledWith("user-new");
  });

  it("does not treat a known account's unsynced rows as a guest's", async () => {
    lastSignedInUserId = "user-new";
    safety = { pendingOpCount: 1, unsyncedRowCount: 1, hasUnsyncedData: true };

    expect(await prepareSignedInSession("user-new")).toBe("ready");
  });
});
