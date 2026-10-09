/**
 * Chat-completion request parameters that differ between providers.
 *
 * OpenAI's current models reject `max_tokens` (they want `max_completion_tokens`)
 * and reject any `temperature` but the default. Other OpenAI-compatible
 * providers (Groq, OpenRouter, local servers) still expect `max_tokens`. So the
 * request starts from the likeliest shape for the provider and changes only
 * what the provider itself names as unsupported. Pure, with no Deno APIs, so the
 * app's unit tests import it directly.
 */
export interface CompletionParams {
  tokenParam: "max_tokens" | "max_completion_tokens";
  sendTemperature: boolean;
}

/** Output ceiling for providers that take `max_tokens`. */
export const OUTPUT_TOKEN_CAP = 300;
/**
 * Ceiling for `max_completion_tokens`, which also counts the model's hidden
 * reasoning. A summary and three recommendations come to about 120 tokens, but
 * 300 can be used up on reasoning before any answer appears. It is only a
 * ceiling: tokens are billed as used.
 */
export const COMPLETION_TOKEN_CAP = 800;
export const TEMPERATURE = 0.4;

export function initialCompletionParams(baseUrl: string): CompletionParams {
  let host = "";
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    // An unparseable URL fails at fetch time with its own message.
  }
  return host === "api.openai.com"
    ? { tokenParam: "max_completion_tokens", sendTemperature: false }
    : { tokenParam: "max_tokens", sendTemperature: true };
}

export function buildCompletionBody(
  model: string,
  messages: Array<{ role: string; content: string }>,
  params: CompletionParams,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages,
    [params.tokenParam]:
      params.tokenParam === "max_tokens"
        ? OUTPUT_TOKEN_CAP
        : COMPLETION_TOKEN_CAP,
  };
  if (params.sendTemperature) body.temperature = TEMPERATURE;
  return body;
}

/** The parameter a 400 names as unsupported, e.g. `max_tokens`, or null. */
function unsupportedParameter(detail: string): string | null {
  let message = detail;
  try {
    const parsed = JSON.parse(detail) as {
      error?: { message?: unknown; param?: unknown } | string;
    };
    const error = parsed?.error;
    if (typeof error === "object" && error) {
      if (typeof error.param === "string") return error.param;
      if (typeof error.message === "string") message = error.message;
    } else if (typeof error === "string") {
      message = error;
    }
  } catch {
    // Not JSON; read the text as it is.
  }
  const named =
    /unsupported (?:parameter|value)[^'"`]*['"`]([a-z_]+)['"`]/i.exec(message);
  if (named) return named[1];
  return /temperature[^.]*(?:not support|only the default|unsupported)/i.test(
    message,
  )
    ? "temperature"
    : null;
}

/**
 * Changed parameters for a retry after a 400, or null when the rejection is not
 * about something this can change. Each call fixes one named problem, so a
 * retry that is rejected for something else does not loop.
 */
export function adaptCompletionParams(
  current: CompletionParams,
  detail: string,
): CompletionParams | null {
  const param = unsupportedParameter(detail);
  if (param === "max_tokens" && current.tokenParam === "max_tokens") {
    return { ...current, tokenParam: "max_completion_tokens" };
  }
  if (
    param === "max_completion_tokens" &&
    current.tokenParam === "max_completion_tokens"
  ) {
    return { ...current, tokenParam: "max_tokens" };
  }
  if (param === "temperature" && current.sendTemperature) {
    return { ...current, sendTemperature: false };
  }
  return null;
}
