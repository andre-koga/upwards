import { describe, expect, it } from "vitest";
import { describeInsightError, readInsightErrorBody } from "./insight-errors";
import {
  MAX_PROVIDER_MESSAGE_LENGTH,
  providerMessage,
} from "../../../../supabase/functions/_shared/provider-message";

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

const failure = (body: unknown, status = 502) => ({
  message: "Edge Function returned a non-2xx status code",
  context: new Response(JSON.stringify(body), { status }),
});

describe("readInsightErrorBody", () => {
  it("reads the JSON the function sent", async () => {
    const body = await readInsightErrorBody(
      failure({ error: "x", code: "provider_rejected", provider_status: 404 })
    );
    expect(body).toEqual({
      error: "x",
      code: "provider_rejected",
      provider_status: 404,
    });
  });

  it("leaves the response readable for a second reader", async () => {
    const error = failure({ error: "x" });
    await readInsightErrorBody(error);
    await expect(error.context.json()).resolves.toEqual({ error: "x" });
  });

  it.each([
    ["no context", { message: "boom" }],
    [
      "a body that is not JSON",
      { context: new Response("<html>", { status: 502 }) },
    ],
    ["a JSON array", { context: new Response("[1]", { status: 502 }) }],
    ["null", null],
  ])("returns null for %s", async (_label, error) => {
    await expect(readInsightErrorBody(error)).resolves.toBeNull();
  });
});

describe("describeInsightError", () => {
  it("names the provider's refusal with its status and reason", () => {
    const text = describeInsightError(
      {
        error: "AI provider request failed",
        code: "provider_rejected",
        provider_status: 404,
        provider_message: "The model `gpt-6-luna` does not exist",
      },
      "generic",
      t
    );
    expect(text).toContain("error.providerRejected");
    expect(text).toContain("404");
    expect(text).toContain("gpt-6-luna");
  });

  it.each([
    ["rate_limited", "error.rateLimited"],
    ["not_configured", "error.notConfigured"],
    ["provider_unreachable", "error.providerUnreachable"],
    ["provider_empty", "error.providerEmpty"],
  ])("maps %s to its own message", (code, key) => {
    expect(describeInsightError({ code }, "generic", t)).toBe(key);
  });

  it("falls back to the server's text, then to the raw message", () => {
    expect(
      describeInsightError({ error: "Payload too large" }, "generic", t)
    ).toBe("Payload too large");
    expect(describeInsightError(null, "generic", t)).toBe("generic");
    expect(describeInsightError(null, "", t)).toBe("Request failed");
  });
});

describe("providerMessage", () => {
  const key = "sk-proj-AbCdEf0123456789secretvalue";

  it("takes the message out of an OpenAI-style error", () => {
    const raw = JSON.stringify({
      error: {
        message: "The model `x` does not exist",
        type: "invalid_request_error",
      },
    });
    expect(providerMessage(raw, key)).toBe("The model `x` does not exist");
  });

  it("removes the exact key wherever it appears", () => {
    const out = providerMessage(
      `bad request for ${key}, retry with ${key}`,
      key
    );
    expect(out).not.toContain(key);
    expect(out).toBe("bad request for [key], retry with [key]");
  });

  it("removes a key that has no recognisable prefix", () => {
    // Azure, local servers and proxies use keys the pattern cannot recognise;
    // only the exact match protects those.
    const plain = "9f8e7d6c5b4a39281706f5e4d3c2b1a0";
    const out = providerMessage(
      `Invalid key ${plain} for this resource`,
      plain
    );
    expect(out).not.toContain(plain);
    expect(out).toBe("Invalid key [key] for this resource");
  });

  it("removes a masked key the provider echoes back", () => {
    const raw = JSON.stringify({
      error: {
        message:
          "Incorrect API key provided: sk-proj-********************wxyz.",
      },
    });
    const out = providerMessage(raw, key);
    expect(out).not.toContain("sk-proj");
    expect(out).toContain("[key]");
  });

  it("removes keys of other shapes", () => {
    expect(providerMessage("key-abcd1234efgh and rk-9876zyxw5432", "")).toBe(
      "[key] and [key]"
    );
  });

  it("collapses whitespace and caps the length", () => {
    const out = providerMessage("a\n\n  b " + "z".repeat(1000), "");
    expect(out.startsWith("a b ")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(MAX_PROVIDER_MESSAGE_LENGTH);
    expect(out.endsWith("…")).toBe(true);
  });

  it("handles an empty body", () => {
    expect(providerMessage("", key)).toBe("");
  });
});
