/**
 * The provider's own reason for a refusal, safe to show the account's owner.
 *
 * It is their provider, but an error body can echo the request or the key, so
 * the key (and anything shaped like one) is removed and the text is capped.
 * Pure, with no Deno APIs, so the app's unit tests import it directly.
 */
export const MAX_PROVIDER_MESSAGE_LENGTH = 240;

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function providerMessage(raw: string, apiKey: string): string {
  let message = raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    const nested = (parsed as { error?: unknown } | null)?.error;
    const text =
      typeof nested === "string"
        ? nested
        : (nested as { message?: unknown } | null)?.message;
    if (typeof text === "string") message = text;
  } catch {
    // Not JSON; use the text as it is.
  }
  if (apiKey) message = message.split(apiKey).join("[key]");
  // Providers echo a masked key ("sk-abc***xyz"), which the exact match misses.
  message = message.replace(/\b(sk|pk|rk|key)-[A-Za-z0-9_*.-]{4,}/g, "[key]");
  return truncate(
    message.replace(/\s+/g, " ").trim(),
    MAX_PROVIDER_MESSAGE_LENGTH,
  );
}
