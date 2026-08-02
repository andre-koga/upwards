import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appLogs: Array<{
  id: string;
  level: string;
  context: string;
  message: string;
  created_at: string;
}> = [];
let idCounter = 0;

vi.mock("@/lib/db", () => ({
  db: {
    appLogs: {
      add: async (row: (typeof appLogs)[number]) => {
        appLogs.push(row);
      },
    },
  },
  newId: () => `log-${++idCounter}`,
  now: () => "2026-08-01T12:00:00.000Z",
}));

import {
  getErrorMessage,
  isTransientNetworkError,
  logError,
} from "./error-utils";

describe("isTransientNetworkError", () => {
  it("detects Failed to fetch and AbortError", () => {
    expect(isTransientNetworkError(new Error("Failed to fetch"))).toBe(true);
    expect(
      isTransientNetworkError(new Error("NetworkError when attempting"))
    ).toBe(true);
    expect(isTransientNetworkError({ message: "Failed to fetch" })).toBe(true);
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    expect(isTransientNetworkError(abort)).toBe(true);
  });

  it("rejects durable sync failures", () => {
    expect(isTransientNetworkError(new Error("JWT expired"))).toBe(false);
    expect(
      isTransientNetworkError(new Error("Could not find the function"))
    ).toBe(false);
  });
});

describe("logError", () => {
  beforeEach(() => {
    appLogs.length = 0;
    idCounter = 0;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not persist transient network errors", async () => {
    logError("Sync failed", new Error("Failed to fetch"));
    await Promise.resolve();
    expect(appLogs).toHaveLength(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it("persists durable errors", async () => {
    logError("Sync failed", new Error("permission denied"));
    await Promise.resolve();
    expect(appLogs).toHaveLength(1);
    expect(appLogs[0].message).toBe("permission denied");
    expect(getErrorMessage(new Error("x"))).toBe("x");
  });
});
