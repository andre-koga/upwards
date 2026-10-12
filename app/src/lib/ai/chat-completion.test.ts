import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestCompletion,
  type ProviderSettings,
} from "../../../../supabase/functions/_shared/chat-completion";

const settings: ProviderSettings = {
  base_url: "https://api.openai.com/v1",
  model: "m",
  api_key: "sk-secret-key-123",
};
const messages = [{ role: "user", content: "{}" }];

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requestCompletion", () => {
  it("returns the model's text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        reply(200, { choices: [{ message: { content: "hi" } }] })
      )
    );
    expect(await requestCompletion(settings, messages)).toEqual({
      ok: true,
      text: "hi",
    });
  });

  it("sends the caller's token ceiling", async () => {
    const fetchMock = vi.fn(async () =>
      reply(200, { choices: [{ message: { content: "hi" } }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    await requestCompletion(
      { ...settings, base_url: "http://localhost:1/v1" },
      messages,
      { maxTokens: 600, maxCompletionTokens: 1200 }
    );
    const sent = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string
    );
    expect(sent.max_tokens).toBe(600);
  });

  it("retries once with the parameter the provider names as unsupported", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        reply(400, {
          error: {
            message: "Unsupported parameter: 'max_completion_tokens'.",
            param: "max_completion_tokens",
          },
        })
      )
      .mockResolvedValueOnce(
        reply(200, { choices: [{ message: { content: "ok" } }] })
      );
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await requestCompletion(settings, messages);
    expect(outcome).toEqual({ ok: true, text: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a provider refusal without the key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        reply(401, { error: { message: `bad key ${settings.api_key}` } })
      )
    );
    const outcome = await requestCompletion(settings, messages);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.status).toBe(502);
    expect(outcome.body.code).toBe("provider_rejected");
    expect(outcome.body.provider_status).toBe(401);
    expect(JSON.stringify(outcome.body)).not.toContain(settings.api_key);
  });

  it("reports an empty answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply(200, { choices: [{ message: { content: "" } }] }))
    );
    const outcome = await requestCompletion(settings, messages);
    expect(outcome).toMatchObject({
      ok: false,
      body: { code: "provider_empty" },
    });
  });

  it("reports an unreachable provider", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      })
    );
    const outcome = await requestCompletion(settings, messages);
    expect(outcome).toMatchObject({
      ok: false,
      body: { code: "provider_unreachable" },
    });
  });
});
