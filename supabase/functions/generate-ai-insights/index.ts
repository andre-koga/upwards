import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { providerMessage, truncate } from "../_shared/provider-message.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY",
  );
}

// Token-budget guardrails (see docs/architecture — keep this cheap):
// aggregated stats only, capped output tokens, and a hard daily call cap
// per user so a buggy client can't burn through someone's key budget.
const MAX_CALLS_PER_DAY = 20;
const MAX_OUTPUT_TOKENS = 300;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_RECOMMENDATIONS = 3;
const MAX_RECOMMENDATION_LENGTH = 220;
const MAX_SUMMARY_LENGTH = 300;
// Aggregated stats payload only — never raw journal/task text. Cap its size
// defensively since it is untrusted client input.
const MAX_PAYLOAD_BYTES = 4000;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

interface InsightResult {
  summary: string;
  recommendations: string[];
}

function parseModelOutput(raw: string): InsightResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Model didn't return clean JSON — fall back to raw text as the summary.
    return {
      summary: truncate(raw.trim(), MAX_SUMMARY_LENGTH),
      recommendations: [],
    };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return {
      summary: truncate(raw.trim(), MAX_SUMMARY_LENGTH),
      recommendations: [],
    };
  }
  const obj = parsed as Record<string, unknown>;
  const summary =
    typeof obj.summary === "string"
      ? truncate(obj.summary.trim(), MAX_SUMMARY_LENGTH)
      : "";
  const recommendations = Array.isArray(obj.recommendations)
    ? obj.recommendations
        .filter((item): item is string => typeof item === "string")
        .slice(0, MAX_RECOMMENDATIONS)
        .map((item) => truncate(item.trim(), MAX_RECOMMENDATION_LENGTH))
    : [];
  return { summary, recommendations };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Missing bearer token" });

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);
  if (userError || !user) return json(401, { error: "Invalid auth token" });

  const bodyText = await request.text();
  if (bodyText.length > MAX_PAYLOAD_BYTES) {
    return json(413, { error: "Payload too large" });
  }
  let statsPayload: unknown;
  try {
    statsPayload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: settings, error: settingsError } = await adminClient
    .from("user_ai_settings")
    .select("base_url, model, api_key, calls_today, calls_reset_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (settingsError) return json(500, { error: "Could not load AI settings" });
  if (!settings) {
    return json(400, {
      error: "AI is not configured yet",
      code: "not_configured",
    });
  }

  const today = todayUtc();
  const callsToday =
    settings.calls_reset_at === today ? settings.calls_today : 0;
  if (callsToday >= MAX_CALLS_PER_DAY) {
    return json(429, {
      error: "Daily AI insight limit reached — try again tomorrow",
      code: "rate_limited",
    });
  }

  const systemPrompt =
    "You are a terse habit coach. You receive aggregated statistics about a " +
    "user's habits, tasks, and journaling — never raw journal text. Reply with " +
    "compact JSON only, matching exactly: " +
    '{"summary": string, "recommendations": string[]}. ' +
    `The summary is one sentence. Provide at most ${MAX_RECOMMENDATIONS} short, ` +
    "specific, actionable recommendations grounded only in the numbers given. " +
    "No preamble, no markdown, JSON only.";

  let completionText: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(`${settings.base_url}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(statsPayload) },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      const detail = await response.text();
      console.error("AI provider error:", response.status, detail);
      return json(502, {
        error: "AI provider request failed",
        code: "provider_rejected",
        provider_status: response.status,
        provider_message: providerMessage(detail, settings.api_key),
      });
    }
    const data = await response.json();
    completionText = data?.choices?.[0]?.message?.content ?? "";
    if (!completionText) {
      return json(502, {
        error: "AI provider returned an empty response",
        code: "provider_empty",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    console.error("AI provider request threw:", message);
    return json(502, {
      error: "Could not reach the AI provider",
      code: "provider_unreachable",
    });
  }

  // Only increment the cap after a successful provider call.
  const { error: updateError } = await adminClient
    .from("user_ai_settings")
    .update({ calls_today: callsToday + 1, calls_reset_at: today })
    .eq("user_id", user.id);
  if (updateError) {
    console.error("Could not update AI call counter:", updateError.message);
  }

  const insight = parseModelOutput(completionText);
  return json(200, insight);
});
