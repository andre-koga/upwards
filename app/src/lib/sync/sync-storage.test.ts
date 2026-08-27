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

  it("does not re-bootstrap a device that already completed the cutover", () => {
    // Renaming this key to force a repeat bootstrap is what caused the #58
    // data loss: the bootstrap ends in applySyncSnapshot, which used to
    // hard-delete every local row absent from the server. A device that has
    // already cut over must stay cut over.
    storage.set("okhabit_sync_protocol_v2", "1");
    expect(loadSyncProtocolV2()).toBe(true);
  });

  it("bootstraps a device that has never cut over", () => {
    expect(loadSyncProtocolV2()).toBe(false);

    saveSyncProtocolV2();
    expect(loadSyncProtocolV2()).toBe(true);
  });
});
