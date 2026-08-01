import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncDeviceRecord } from "@/lib/db/types";

const storage = new Map<string, string>();

function mockLocalStorage() {
  globalThis.localStorage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null;
    },
  } as Storage;
}

const syncDevices: SyncDeviceRecord[] = [];
let idCounter = 0;

vi.mock("@/lib/db", () => ({
  db: {
    syncDevices: {
      get: async (id: string) => syncDevices.find((d) => d.id === id),
      add: async (record: SyncDeviceRecord) => {
        syncDevices.push(record);
      },
      update: async (id: string, patch: Partial<SyncDeviceRecord>) => {
        const row = syncDevices.find((d) => d.id === id);
        if (row) Object.assign(row, patch);
      },
    },
  },
  newId: () => `device-${++idCounter}`,
  now: () => "2026-08-01T12:00:00.000Z",
}));

import {
  getOrCreateDeviceId,
  ensureLocalDeviceRecord,
  touchLocalDevice,
} from "./device-id";

describe("device-id", () => {
  beforeEach(() => {
    storage.clear();
    syncDevices.length = 0;
    idCounter = 0;
    mockLocalStorage();
  });

  it("creates and persists a device id in localStorage", () => {
    const first = getOrCreateDeviceId();
    const second = getOrCreateDeviceId();
    expect(first).toBe(second);
    expect(storage.get("okhabit:device_id")).toBe(first);
  });

  it("ensureLocalDeviceRecord creates a Dexie row", async () => {
    const record = await ensureLocalDeviceRecord();
    expect(record.id).toBe(getOrCreateDeviceId());
    expect(syncDevices.length).toBe(1);
    expect(syncDevices[0].last_seen_at).toBe("2026-08-01T12:00:00.000Z");
  });

  it("touchLocalDevice updates last_seen_at and account_id", async () => {
    await ensureLocalDeviceRecord();
    await touchLocalDevice("user-1");
    expect(syncDevices[0].account_id).toBe("user-1");
    expect(syncDevices[0].last_seen_at).toBe("2026-08-01T12:00:00.000Z");
  });
});
