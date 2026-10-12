import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

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

  it("reports sign-in requests that fail while the server is reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: { method?: string }) => {
        if (init?.method === "POST") throw new TypeError("Load failed");
        return new Response("", { status: 401 });
      })
    );
    const result = await retrySessionNow();
    expect(result.reach).toEqual({ ok: true });
    expect(result.post).toEqual({
      ok: false,
      reason: "unreachable",
      detail: "Load failed",
    });
    expect(result.refresh).toBeNull();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("forgets this project's session without touching anything else, then reloads", () => {
    const store = new Map<string, string>([
      ["sb-abcd-auth-token", "{}"],
      ["sb-abcd-auth-token-code-verifier", "v"],
      ["sb-other-auth-token", "{}"],
      ["okhabit_last_signed_in_user_id", "user-1"],
    ]);
    const reload = vi.fn();
    vi.stubGlobal("localStorage", {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      removeItem: (k: string) => store.delete(k),
    });
    vi.stubGlobal("window", { location: { reload } });
    vi.stubEnv("VITE_SUPABASE_URL", "https://abcd.supabase.co");

    forgetSessionKeepData();

    expect([...store.keys()].sort()).toEqual([
      "okhabit_last_signed_in_user_id",
      "sb-other-auth-token",
    ]);
    expect(reload).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();
  });
});
