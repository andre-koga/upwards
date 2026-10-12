import { beforeEach, describe, expect, it, vi } from "vitest";

const { refreshSession, signOut } = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { refreshSession, signOut } },
}));

import {
  checkServerReach,
  forgetSessionKeepData,
  retrySessionNow,
} from "./auth-recovery";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("auth recovery", () => {
  beforeEach(() => {
    refreshSession.mockReset();
    signOut.mockClear();
    setOnline(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 }))
    );
  });

  it("treats any HTTP answer below 500 as reaching the server", async () => {
    expect(await checkServerReach()).toEqual({ ok: true });
  });

  it("reports a server error as unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 }))
    );
    const result = await checkServerReach();
    expect(result).toMatchObject({ ok: false, reason: "unreachable" });
  });

  it("reports the fetch failure message when the request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Load failed");
      })
    );
    expect(await checkServerReach()).toEqual({
      ok: false,
      reason: "unreachable",
      detail: "Load failed",
    });
  });

  it("does not try to refresh when the device is offline", async () => {
    setOnline(false);
    const result = await retrySessionNow();
    expect(result.reach).toMatchObject({ ok: false, reason: "offline" });
    expect(result.refresh).toBeNull();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("reports success when the session refreshes", async () => {
    refreshSession.mockResolvedValue({ data: {}, error: null });
    const result = await retrySessionNow();
    expect(result.refresh).toEqual({ ok: true });
  });

  it("tells a refused session apart from a failed request", async () => {
    refreshSession.mockResolvedValue({
      data: {},
      error: Object.assign(new Error("Invalid Refresh Token"), { status: 400 }),
    });
    expect((await retrySessionNow()).refresh).toMatchObject({
      ok: false,
      reason: "rejected",
    });

    refreshSession.mockResolvedValue({
      data: {},
      error: Object.assign(new Error("Load failed"), { status: 0 }),
    });
    expect((await retrySessionNow()).refresh).toMatchObject({
      ok: false,
      reason: "unreachable",
    });
  });

  it("forgets the session locally only, never signing out everywhere", async () => {
    await forgetSessionKeepData();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
