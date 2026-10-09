/**
 * What `generate-ai-insights` says when it refuses or fails.
 *
 * supabase-js hides the response body of a non-2xx answer behind one generic
 * sentence ("Edge Function returned a non-2xx status code"). The function always
 * sends JSON with an `error` and, for the cases the app can act on, a `code`, so
 * the body is read from `error.context` and turned into something specific.
 */
export interface InsightErrorBody {
  error?: string;
  code?: string;
  /** HTTP status the AI provider answered with, when it answered. */
  provider_status?: number;
  /** The provider's own reason, already redacted by the function. */
  provider_message?: string;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The JSON body of a failed function call, or null when there is none. */
export async function readInsightErrorBody(
  error: unknown
): Promise<InsightErrorBody | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return null;
  try {
    const body: unknown = await context.clone().json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as InsightErrorBody;
  } catch {
    return null;
  }
}

/** Specific, translated text for a failed call; falls back to the raw message. */
export function describeInsightError(
  body: InsightErrorBody | null,
  fallback: string,
  t: Translate
): string {
  switch (body?.code) {
    case "rate_limited":
      return t("error.rateLimited");
    case "not_configured":
      return t("error.notConfigured");
    case "provider_rejected":
      return t("error.providerRejected", {
        status: body.provider_status ?? "?",
        detail: body.provider_message || body.error || "",
      });
    case "provider_unreachable":
      return t("error.providerUnreachable");
    case "provider_empty":
      return t("error.providerEmpty");
    default:
      return body?.error || fallback || "Request failed";
  }
}
