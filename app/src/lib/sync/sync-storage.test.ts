import { beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  advanceLastAppliedSequence,
  loadLastAppliedSequence,
  saveLastAppliedSequence,
  loadSyncProtocolV2,
  saveSyncProtocolV2,
} from "./sync-storage";

describe("last applied sync sequence", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("does not jump the pull cursor backwards or skip gaps from a higher push sequence", () => {
    saveLastAppliedSequence(4);
    advanceLastAppliedSequence(12);
    expect(loadLastAppliedSequence()).toBe(12);
    advanceLastAppliedSequence(9);
    expect(loadLastAppliedSequence()).toBe(12);
  });
});

describe("bootstrap flag", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("re-bootstraps devices that completed the original v2 cutover", () => {
    // A device damaged by the natural-id cutover has the old key set. It must
    // still bootstrap once more so the snapshot clears local journal
    // tombstones the op stream cannot heal.
    storage.set("okhabit_sync_protocol_v2", "1");
    expect(loadSyncProtocolV2()).toBe(false);

    saveSyncProtocolV2();
    expect(loadSyncProtocolV2()).toBe(true);
  });
});
