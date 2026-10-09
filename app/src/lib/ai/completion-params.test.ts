import { describe, expect, it } from "vitest";
import {
  COMPLETION_TOKEN_CAP,
  OUTPUT_TOKEN_CAP,
  TEMPERATURE,
  adaptCompletionParams,
  buildCompletionBody,
  initialCompletionParams,
  type CompletionParams,
} from "../../../../supabase/functions/_shared/completion-params";

const messages = [{ role: "user", content: "{}" }];

// The exact bodies api.openai.com returned for gpt-6-luna on 2026-10-09.
const maxTokensRejected = JSON.stringify({
  error: {
    message:
      "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
    type: "invalid_request_error",
    param: "max_tokens",
    code: "unsupported_parameter",
  },
});
const temperatureRejected = JSON.stringify({
  error: {
    message:
      "Unsupported value: 'temperature' does not support 0.4 with this model. Only the default (1) value is supported.",
    type: "invalid_request_error",
    param: "temperature",
    code: "unsupported_value",
  },
});

describe("initialCompletionParams", () => {
  it("starts OpenAI on the newer shape", () => {
    expect(initialCompletionParams("https://api.openai.com/v1")).toEqual({
      tokenParam: "max_completion_tokens",
      sendTemperature: false,
    });
  });

  it.each([
    "https://api.groq.com/openai/v1",
    "https://openrouter.ai/api/v1",
    "http://localhost:11434/v1",
    "https://my-resource.openai.azure.com/openai/deployments/x",
    "not a url",
    "",
  ])("starts %s on the widely supported shape", (url) => {
    expect(initialCompletionParams(url)).toEqual({
      tokenParam: "max_tokens",
      sendTemperature: true,
    });
  });

  it("matches the host exactly, not by substring", () => {
    expect(
      initialCompletionParams("https://api.openai.com.evil.example/v1")
        .tokenParam
    ).toBe("max_tokens");
  });
});

describe("buildCompletionBody", () => {
  it("sends exactly one token limit, with the cap for that parameter", () => {
    const legacy = buildCompletionBody("m", messages, {
      tokenParam: "max_tokens",
      sendTemperature: true,
    });
    expect(legacy.max_tokens).toBe(OUTPUT_TOKEN_CAP);
    expect(legacy).not.toHaveProperty("max_completion_tokens");
    expect(legacy.temperature).toBe(TEMPERATURE);

    const modern = buildCompletionBody("m", messages, {
      tokenParam: "max_completion_tokens",
      sendTemperature: false,
    });
    expect(modern.max_completion_tokens).toBe(COMPLETION_TOKEN_CAP);
    expect(modern).not.toHaveProperty("max_tokens");
    expect(modern).not.toHaveProperty("temperature");
  });

  it("keeps the model and messages", () => {
    const body = buildCompletionBody("gpt-6-luna", messages, {
      tokenParam: "max_tokens",
      sendTemperature: true,
    });
    expect(body.model).toBe("gpt-6-luna");
    expect(body.messages).toBe(messages);
  });
});

describe("adaptCompletionParams", () => {
  const legacy: CompletionParams = {
    tokenParam: "max_tokens",
    sendTemperature: true,
  };
  const modern: CompletionParams = {
    tokenParam: "max_completion_tokens",
    sendTemperature: false,
  };

  it("switches the token parameter when max_tokens is rejected", () => {
    expect(adaptCompletionParams(legacy, maxTokensRejected)).toEqual({
      tokenParam: "max_completion_tokens",
      sendTemperature: true,
    });
  });

  it("drops temperature when it is rejected", () => {
    expect(adaptCompletionParams(legacy, temperatureRejected)).toEqual({
      tokenParam: "max_tokens",
      sendTemperature: false,
    });
  });

  it("goes back to max_tokens if a provider rejects max_completion_tokens", () => {
    const detail = JSON.stringify({
      error: {
        message: "Unrecognized request argument",
        param: "max_completion_tokens",
      },
    });
    expect(adaptCompletionParams(modern, detail)).toEqual({
      tokenParam: "max_tokens",
      sendTemperature: false,
    });
  });

  it("reads the parameter from the message when there is no param field", () => {
    const detail = JSON.stringify({
      error: {
        message: "Unsupported parameter: 'max_tokens' is not supported.",
      },
    });
    expect(adaptCompletionParams(legacy, detail)?.tokenParam).toBe(
      "max_completion_tokens"
    );
  });

  it("reads a plain-text body", () => {
    expect(
      adaptCompletionParams(legacy, "Unsupported parameter: 'max_tokens'")
        ?.tokenParam
    ).toBe("max_completion_tokens");
  });

  it.each([
    [
      "an unrelated 400",
      JSON.stringify({ error: { message: "The model `x` does not exist" } }),
    ],
    [
      "a bad key",
      JSON.stringify({ error: { message: "Incorrect API key provided" } }),
    ],
    ["an empty body", ""],
    [
      "a parameter it cannot change",
      JSON.stringify({ error: { param: "messages", message: "bad" } }),
    ],
  ])("gives up on %s", (_label, detail) => {
    expect(adaptCompletionParams(legacy, detail)).toBeNull();
  });

  it("does not repeat a fix it has already made", () => {
    expect(adaptCompletionParams(modern, maxTokensRejected)).toBeNull();
    expect(
      adaptCompletionParams(
        { ...legacy, sendTemperature: false },
        temperatureRejected
      )
    ).toBeNull();
  });

  it("settles the real OpenAI case in two steps", () => {
    // gpt-6-luna on a non-OpenAI-looking base URL: both rejections, in order.
    let params = initialCompletionParams("https://proxy.example/v1");
    params = adaptCompletionParams(params, maxTokensRejected)!;
    params = adaptCompletionParams(params, temperatureRejected)!;
    expect(params).toEqual({
      tokenParam: "max_completion_tokens",
      sendTemperature: false,
    });
    expect(adaptCompletionParams(params, maxTokensRejected)).toBeNull();
  });
});
