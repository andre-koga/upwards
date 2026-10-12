/**
 * One chat-completion call against the user's own provider, with the retry that
 * fixes a parameter the provider names as unsupported (see completion-params.ts).
 *
 * Failures come back as the JSON body and status the edge function should send,
 * in the same shapes `generate-ai-insights` uses, so the app reads both the same
 * way (`lib/ai/insight-errors.ts`). Uses only `fetch` and `AbortController`, so
 * the app's unit tests import it directly.
 */
import {
  adaptCompletionParams,
  buildCompletionBody,
  initialCompletionParams,
  type TokenCaps,
} from "./completion-params.ts";
import { providerMessage } from "./provider-message.ts";

const MAX_PARAM_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20000;

export interface ProviderSettings {
  base_url: string;
  model: string;
  api_key: string;
}

export type CompletionOutcome =
  | { ok: true; text: string }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function requestCompletion(
  settings: ProviderSettings,
  messages: Array<{ role: string; content: string }>,
  caps?: TokenCaps,
): Promise<CompletionOutcome> {
  try {
    let params = initialCompletionParams(settings.base_url);
    let response: Response | null = null;
    for (let attempt = 0; attempt < MAX_PARAM_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        response = await fetch(`${settings.base_url}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            buildCompletionBody(settings.model, messages, params, caps),
          ),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (response.ok || response.status !== 400) break;
      const detail = await response.clone().text();
      const adapted = adaptCompletionParams(params, detail);
      if (!adapted) break;
      params = adapted;
    }
    if (!response) throw new Error("No response");
    if (!response.ok) {
      const detail = await response.text();
      console.error("AI provider error:", response.status, detail);
      return {
        ok: false,
        status: 502,
        body: {
          error: "AI provider request failed",
          code: "provider_rejected",
          provider_status: response.status,
          provider_message: providerMessage(detail, settings.api_key),
        },
      };
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    if (!text) {
      return {
        ok: false,
        status: 502,
        body: {
          error: "AI provider returned an empty response",
          code: "provider_empty",
        },
      };
    }
    return { ok: true, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    console.error("AI provider request threw:", message);
    return {
      ok: false,
      status: 502,
      body: {
        error: "Could not reach the AI provider",
        code: "provider_unreachable",
      },
    };
  }
}
