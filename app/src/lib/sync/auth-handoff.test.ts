import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An account switch runs from an onAuthStateChange callback, which fires on token
 * refresh and app boot, not only after a deliberate sign-out. It used to call
 * clearLocalSyncData() unconditionally, on the strength of a comment saying the
 * caller "should have pushed" — which nothing enforced. That wiped all ten synced
 * tables plus the pending-op queue, silently, with no prompt and no recovery.
 */

const clearLocalSyncData = vi.fn(async () => {});
const hasLocalSyncableData = vi.fn(async () => false);
const startAutoSync = vi.fn();
let safety = {
  pendingOpCount: 0,
  unsyncedRowCount: 0,
  hasUnsyncedData: false,
};
let lastSignedInUserId: string | null = null;

vi.mock("./clear-local-sync-data", () => ({
  clearLocalSyncData: () => clearLocalSyncData(),
  hasLocalSyncableData: () => hasLocalSyncableData(),
}));

vi.mock("./unsynced-data", () => ({
  getLocalSyncSafetyStatus: async () => safety,
}));

vi.mock("./index", () => ({
  syncEngine: { startAutoSync: (...args: unknown[]) => startAutoSync(...args) },
}));

vi.mock("./sync-storage", () => ({
  loadLastSignedInUserId: () => lastSignedInUserId,
  saveLastSignedInUserId: (id: string) => {
    lastSignedInUserId = id;
  },
  clearLastSignedInUserId: () => {
    lastSignedInUserId = null;
  },
}));

const { prepareSignedInSession, discardPreviousAccountData } = await import(
  "./auth-handoff"
);

describe("account switch handoff", () => {
  beforeEach(() => {
    clearLocalSyncData.mockClear();
    hasLocalSyncableData.mockClear();
    startAutoSync.mockClear();
    safety = {
      pendingOpCount: 0,
      unsyncedRowCount: 0,
      hasUnsyncedData: false,
    };
    lastSignedInUserId = null;
  });

  it("refuses to wipe when the previous account left unsynced data", async () => {
    lastSignedInUserId = "user-previous";
    safety = {
      pendingOpCount: 1,
      unsyncedRowCount: 0,
      hasUnsyncedData: true,
    };

    const result = await prepareSignedInSession("user-new");

    expect(result).toBe("needs_account_switch_choice");
    expect(clearLocalSyncData).not.toHaveBeenCalled();
    // Must not start syncing either: pulling the new account's rows on top of the
    // previous account's unsynced ones would merge two accounts locally.
    expect(startAutoSync).not.toHaveBeenCalled();
    // The previous user id has to survive so the user can sign back in and recover.
    expect(lastSignedInUserId).toBe("user-previous");
  });

  it("wipes on account switch once everything is genuinely synced", async () => {
    lastSignedInUserId = "user-previous";

    const result = await prepareSignedInSession("user-new");

    expect(result).toBe("ready");
    expect(clearLocalSyncData).toHaveBeenCalledTimes(1);
    expect(lastSignedInUserId).toBe("user-new");
  });

  it("wipes only after the user explicitly confirms discarding", async () => {
    lastSignedInUserId = "user-previous";

    await discardPreviousAccountData("user-new");

    expect(clearLocalSyncData).toHaveBeenCalledTimes(1);
    expect(startAutoSync).toHaveBeenCalledWith(60_000, "user-new");
    expect(lastSignedInUserId).toBe("user-new");
  });

  it("still asks a first-time guest with local data, and never wipes unprompted", async () => {
    hasLocalSyncableData.mockResolvedValueOnce(true);

    const result = await prepareSignedInSession("user-new");

    expect(result).toBe("needs_guest_choice");
    expect(clearLocalSyncData).not.toHaveBeenCalled();
  });

  it("goes straight to sync for a returning user on the same account", async () => {
    lastSignedInUserId = "user-same";
    safety = {
      pendingOpCount: 3,
      unsyncedRowCount: 2,
      hasUnsyncedData: true,
    };

    // Unsynced data is normal here and must not prompt: it is this same account's
    // work, and the next sync tick pushes it.
    const result = await prepareSignedInSession("user-same");

    expect(result).toBe("ready");
    expect(clearLocalSyncData).not.toHaveBeenCalled();
  });
});
