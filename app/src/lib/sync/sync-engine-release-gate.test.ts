import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  push: vi.fn(),
  pull: vi.fn(),
  snapshot: vi.fn(),
  safety: vi.fn(),
  hasServerRows: vi.fn(),
  deviceRegistry: vi.fn(),
  recordSyncIssue: vi.fn(),
}));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
  key: () => null,
  length: 0,
});

vi.mock("@/lib/supabase", () => ({
  supabase: {},
  isSupabaseConfigured: true,
  getCachedUserId: () => "user-1",
  getQueueAccountId: () => "user-1",
}));

vi.mock("@/lib/error-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/error-utils")>()),
  logError: () => {},
}));

vi.mock("./sync-operations", () => ({
  pushPendingOperations: (...args: unknown[]) => {
    mocks.calls.push("push");
    return mocks.push(...args);
  },
  pullAndApplyOperations: (...args: unknown[]) => {
    mocks.calls.push("pull");
    return mocks.pull(...args);
  },
}));

vi.mock("./snapshot-sync", () => ({
  pullAndApplySnapshot: () => {
    mocks.calls.push("snapshot");
    return mocks.snapshot();
  },
}));

vi.mock("./unsynced-data", () => ({
  getLocalSyncSafetyStatus: () => mocks.safety(),
  hasServerSyncedRows: () => mocks.hasServerRows(),
}));

vi.mock("./remote-device-sync", () => ({
  syncDeviceRegistry: (...args: unknown[]) => mocks.deviceRegistry(...args),
}));

vi.mock("./sync-issues-store", () => ({
  recordSyncIssue: (...args: unknown[]) => mocks.recordSyncIssue(...args),
  resolveOpenSyncErrors: async () => 0,
}));

vi.mock("./device-id", () => ({ touchLocalDevice: async () => {} }));
vi.mock("./pending-operations", () => ({
  collapseDuplicatePendingProjectionUpserts: async () => 0,
}));
vi.mock("./realtime-sync", () => ({
  subscribeToRemoteSyncOperations: () => () => {},
  unsubscribeFromRemoteSyncOperations: () => {},
}));
vi.mock("./sync-scheduler", () => ({
  registerSyncScheduler: () => {},
  clearSyncScheduler: () => {},
}));
vi.mock("./release-gate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./release-gate")>()),
  requeueClientOutdatedOperations: async () => 0,
}));

async function loadEngine() {
  vi.resetModules();
  const { syncEngine } = await import("./index");
  const gate = await import("./release-gate");
  const storageModule = await import("./sync-storage");
  return { syncEngine, gate, storage: storageModule };
}

describe("sync engine release gates", () => {
  beforeEach(() => {
    storage.clear();
    // An already-migrated device: skip the one-time protocol v2 bootstrap.
    storage.set("okhabit_sync_protocol_v2", "1");
    mocks.calls.length = 0;
    for (const fn of [
      mocks.push,
      mocks.pull,
      mocks.snapshot,
      mocks.safety,
      mocks.hasServerRows,
      mocks.deviceRegistry,
      mocks.recordSyncIssue,
    ]) {
      fn.mockReset();
    }
    mocks.push.mockResolvedValue({ failed: false });
    mocks.pull.mockResolvedValue({ maxSequence: 5 });
    mocks.safety.mockResolvedValue({ hasUnsyncedData: false });
    mocks.hasServerRows.mockResolvedValue(true);
    mocks.snapshot.mockResolvedValue({ sequence: 9, dataEpoch: 1 });
  });

  it("pushes, then re-bootstraps from the snapshot when the epoch rises", async () => {
    const { syncEngine, gate, storage: syncStorage } = await loadEngine();
    mocks.pull.mockImplementation(async () => {
      gate.recordObservedDataEpoch(1);
      return { maxSequence: 5 };
    });

    await syncEngine.sync();

    expect(mocks.calls).toEqual(["push", "pull", "push", "snapshot"]);
    expect(syncStorage.loadLastDataEpoch()).toBe(1);
    expect(syncStorage.loadLastAppliedSequence()).toBe(9);

    await syncEngine.sync();
    expect(mocks.calls.filter((c) => c === "snapshot")).toHaveLength(1);
  });

  it("holds the snapshot while this device has unsynced data", async () => {
    const { syncEngine, gate, storage: syncStorage } = await loadEngine();
    gate.recordObservedDataEpoch(1);
    mocks.safety.mockResolvedValue({ hasUnsyncedData: true });

    await syncEngine.sync();

    expect(mocks.calls).not.toContain("snapshot");
    expect(syncStorage.loadLastDataEpoch()).toBe(0);

    mocks.safety.mockResolvedValue({ hasUnsyncedData: false });
    await syncEngine.sync();
    expect(mocks.calls.filter((c) => c === "snapshot")).toHaveLength(1);
    expect(syncStorage.loadLastDataEpoch()).toBe(1);
  });

  it("does not snapshot when the epoch is unchanged", async () => {
    const { syncEngine, gate, storage: syncStorage } = await loadEngine();
    syncStorage.saveLastDataEpoch(3);
    gate.recordObservedDataEpoch(3);

    await syncEngine.sync();

    expect(mocks.calls).toEqual(["push", "pull"]);
  });

  /** A device whose cursor says it is caught up, on the server's current epoch. */
  async function caughtUpDevice() {
    const loaded = await loadEngine();
    loaded.gate.resetObservedDataEpochForTests();
    loaded.storage.saveLastAppliedSequence(3019);
    loaded.storage.saveLastDataEpoch(1);
    loaded.gate.recordObservedDataEpoch(1);
    return loaded;
  }

  it("downloads the snapshot again when the cursor says synced but no row ever came from the server", async () => {
    // The cursor and flags live in localStorage, the rows in IndexedDB, and the
    // browser can lose one without the other. Pulling "after sequence N" then
    // finds nothing and the account stays empty for good.
    const { syncEngine, storage: syncStorage } = await caughtUpDevice();
    mocks.hasServerRows.mockResolvedValue(false);
    mocks.snapshot.mockResolvedValue({ sequence: 3020, dataEpoch: 1 });

    await syncEngine.sync();

    expect(mocks.calls).toContain("snapshot");
    expect(syncStorage.loadLastAppliedSequence()).toBe(3020);
    expect(syncStorage.loadSyncProtocolV2()).toBe(true);
  });

  it("leaves a device that holds server rows alone", async () => {
    const { syncEngine } = await caughtUpDevice();

    await syncEngine.sync();

    expect(mocks.calls).toEqual(["push", "pull"]);
  });

  it("holds that download while the device has unsynced data, then runs it", async () => {
    const { syncEngine } = await caughtUpDevice();
    mocks.hasServerRows.mockResolvedValue(false);
    mocks.safety.mockResolvedValue({ hasUnsyncedData: true });

    await syncEngine.sync();
    expect(mocks.calls).not.toContain("snapshot");

    mocks.safety.mockResolvedValue({ hasUnsyncedData: false });
    await syncEngine.sync();
    expect(mocks.calls).toContain("snapshot");
  });

  it("stops syncing and requires an update when the build is turned away", async () => {
    const { syncEngine, gate } = await loadEngine();
    mocks.push.mockRejectedValue(new gate.ClientOutdatedError());

    await syncEngine.sync();

    const state = syncEngine.getState();
    expect(state.updateRequired).toBe(true);
    expect(state.lastError).toBeNull();
    expect(mocks.recordSyncIssue).not.toHaveBeenCalled();
    expect(mocks.deviceRegistry).toHaveBeenCalledWith("user-1");

    mocks.calls.length = 0;
    await syncEngine.sync();
    expect(mocks.calls).toEqual([]);
  });
});
