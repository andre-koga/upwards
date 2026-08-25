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
