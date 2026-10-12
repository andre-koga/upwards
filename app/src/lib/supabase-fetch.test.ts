import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FUNCTION_TIMEOUT_MS,
  fetchWithTimeout,
  REQUEST_TIMEOUT_MS,
} from "./supabase-fetch";

vi.mock("@/lib/error-utils", () => ({ logError: vi.fn() }));

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function stubFetch(
    impl: (input: unknown, init?: RequestInit) => Promise<Response>
  ) {
    const fn = vi.fn(impl);
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  const hangUntilAborted = (_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError"))
      );
    });

  it("returns the response when the request finishes in time", async () => {
    stubFetch(async () => new Response("ok"));
    const response = await fetchWithTimeout("https://x.supabase.co/rest/v1/a");
    expect(await response.text()).toBe("ok");
  });

  it("gives up on a request that never answers, naming it", async () => {
    stubFetch(hangUntilAborted);
    const pending = fetchWithTimeout(
      "https://x.supabase.co/rest/v1/rpc/pull_sync_operations",
      { method: "POST" }
    );
    const assertion = expect(pending).rejects.toThrow(
      /timed out after 30 s: POST \/rest\/v1\/rpc\/pull_sync_operations/
    );
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1);
    await assertion;
  });

  it("gives AI edge functions longer", async () => {
    stubFetch(hangUntilAborted);
    const pending = fetchWithTimeout(
      "https://x.supabase.co/functions/v1/rank-today",
      { method: "POST" }
    );
    let settled = false;
    pending.catch(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1);
    expect(settled).toBe(false);
    const assertion = expect(pending).rejects.toThrow(/timed out after 90 s/);
    await vi.advanceTimersByTimeAsync(FUNCTION_TIMEOUT_MS);
    await assertion;
  });

  it("does not time out storage transfers", async () => {
    const fn = stubFetch(async () => new Response("up"));
    await fetchWithTimeout("https://x.supabase.co/storage/v1/object/b/p", {
      method: "POST",
    });
    expect(fn.mock.calls[0][1]).toEqual({ method: "POST" });
  });

  it("passes a caller's own abort through as the original error", async () => {
    stubFetch(hangUntilAborted);
    const caller = new AbortController();
    const pending = fetchWithTimeout("https://x.supabase.co/rest/v1/a", {
      signal: caller.signal,
    });
    const assertion = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    caller.abort();
    await assertion;
  });
});
