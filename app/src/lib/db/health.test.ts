import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { control, logError } = vi.hoisted(() => ({
  control: { answer: null as null | (() => void), hang: false },
  logError: vi.fn(),
}));

vi.mock("./index", () => ({
  db: {
    tables: [{ count: () => Promise.resolve(0) }],
    transaction: (
      _mode: string,
      _tables: unknown,
      fn: () => Promise<unknown>
    ) =>
      control.hang
        ? new Promise((resolve) => {
            control.answer = () => resolve(fn());
          })
        : fn(),
  },
}));

vi.mock("@/lib/error-utils", () => ({ logError }));

import {
  STALL_MARKER_KEY,
  checkLocalDatabase,
  getLocalDatabaseHealth,
  resetLocalDatabaseHealthForTests,
  subscribeLocalDatabaseHealth,
} from "./health";

const store = new Map<string, string>();

beforeEach(() => {
  vi.useFakeTimers();
  store.clear();
  control.hang = false;
  control.answer = null;
  logError.mockReset();
  vi.stubGlobal("indexedDB", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  resetLocalDatabaseHealthForTests();
});

afterEach(() => {
  resetLocalDatabaseHealthForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("checkLocalDatabase", () => {
  it("reports a database that answers as ok", async () => {
    await expect(checkLocalDatabase(1000)).resolves.toBe(true);
    await vi.runOnlyPendingTimersAsync();
    expect(getLocalDatabaseHealth()).toBe("ok");
    expect(store.has(STALL_MARKER_KEY)).toBe(false);
  });

  it("marks the database stalled when a read outlives the limit", async () => {
    control.hang = true;
    const seen: string[] = [];
    subscribeLocalDatabaseHealth((health) => seen.push(health));

    const result = checkLocalDatabase(1000);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toBe(false);
    expect(getLocalDatabaseHealth()).toBe("stalled");
    expect(seen).toEqual(["stalled"]);
    expect(store.get(STALL_MARKER_KEY)).toBeTruthy();
  });

  it("recovers and logs the stall once the read finally finishes", async () => {
    control.hang = true;
    const result = checkLocalDatabase(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await result;

    control.answer?.();
    await vi.advanceTimersByTimeAsync(0);
    await vi.dynamicImportSettled();

    expect(getLocalDatabaseHealth()).toBe("ok");
    expect(store.has(STALL_MARKER_KEY)).toBe(false);
    expect(logError).toHaveBeenCalledWith(
      "This device's storage stopped responding",
      expect.any(Error)
    );
  });

  it("logs a stall left over from before a restart", async () => {
    store.set(STALL_MARKER_KEY, "2026-10-12T20:00:00.000Z");
    await checkLocalDatabase(1000);
    await vi.advanceTimersByTimeAsync(0);
    await vi.dynamicImportSettled();
    expect(logError).toHaveBeenCalledTimes(1);
    expect(store.has(STALL_MARKER_KEY)).toBe(false);
  });

  it("does not stack reads while one is still pending", async () => {
    control.hang = true;
    const first = checkLocalDatabase(1000);
    const firstAnswer = control.answer;
    const second = checkLocalDatabase(1000);
    expect(control.answer).toBe(firstAnswer);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(Promise.all([first, second])).resolves.toEqual([false, false]);
  });
});
