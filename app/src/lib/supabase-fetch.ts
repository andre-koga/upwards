/**
 * How long a Supabase request may take before the app gives up on it. Without a
 * limit, one request a phone's network stalls leaves sync reading "Syncing…"
 * forever and holds the auth lock, so nothing else (a session refresh, sign-in
 * again) can proceed, and no error is ever raised or logged.
 */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Edge functions call an AI provider, which can take much longer. */
export const FUNCTION_TIMEOUT_MS = 90_000;

function timeoutFor(url: string): number {
  return url.includes("/functions/v1/")
    ? FUNCTION_TIMEOUT_MS
    : REQUEST_TIMEOUT_MS;
}

/** Uploads and downloads of photos and clips can legitimately take longer. */
function isStorageRequest(url: string): boolean {
  return url.includes("/storage/v1/");
}

function describe(input: RequestInfo | URL, init?: RequestInit): string {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  let path = raw;
  try {
    path = new URL(raw).pathname;
  } catch {
    // Relative or odd URL: show it as given.
  }
  const method =
    init?.method ??
    (typeof input === "object" && "method" in input ? input.method : "GET");
  return `${method} ${path}`;
}

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (isStorageRequest(url)) return fetch(input, init);

  const controller = new AbortController();
  let timedOut = false;
  const limit = timeoutFor(url);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, limit);

  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else
      callerSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
  }

  return fetch(input, { ...init, signal: controller.signal })
    .catch((error: unknown) => {
      if (timedOut) {
        const timeout = new Error(
          `Request timed out after ${limit / 1000} s: ${describe(input, init)}`
        );
        // Loaded on demand: the error log lives in the local database, which
        // must not be a dependency of the client that the database layer reaches.
        void import("@/lib/error-utils").then(({ logError }) =>
          logError("Supabase request", timeout)
        );
        throw timeout;
      }
      throw error;
    })
    .finally(() => clearTimeout(timer));
}
