import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requestCompletion } from "../_shared/chat-completion.ts";
import {
  MAX_RANK_ITEMS,
  parseRankRequest,
  parseRanking,
  rankSystemPrompt,
  rankUserMessage,
} from "../_shared/rank-today.ts";

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

// Figures only, a capped answer, and a per-user daily call counter, so a buggy
// client cannot burn through someone's key budget.
const MAX_CALLS_PER_DAY = 20;
// About 12 items of figures; the body is untrusted client input.
const MAX_PAYLOAD_BYTES = 4000;
// Up to MAX_RANK_ITEMS rows of `{"key":"12","reason":"<90 chars>"}`, about 35
// tokens each. `max_completion_tokens` also counts hidden reasoning, so the
// ceiling sits well above the visible answer.
const RANK_TOKEN_CAPS = {
  maxTokens: 120 + MAX_RANK_ITEMS * 40,
  maxCompletionTokens: 1200,
};

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
  let body: unknown;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const rankRequest = parseRankRequest(body);
  if (!rankRequest) return json(400, { error: "Invalid ranking request" });

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
      error: "Daily AI limit reached — try again tomorrow",
      code: "rate_limited",
    });
  }

  const outcome = await requestCompletion(
    settings,
    [
      { role: "system", content: rankSystemPrompt() },
      { role: "user", content: rankUserMessage(rankRequest) },
    ],
    RANK_TOKEN_CAPS,
  );
  if (!outcome.ok) return json(outcome.status, outcome.body);

  // The provider answered, so the call counts, whatever the answer is worth.
  const { error: updateError } = await adminClient
    .from("user_ai_settings")
    .update({ calls_today: callsToday + 1, calls_reset_at: today })
    .eq("user_id", user.id);
  if (updateError) {
    console.error("Could not update AI call counter:", updateError.message);
  }

  const order = parseRanking(outcome.text, rankRequest);
  if (!order) {
    console.error("AI ranking was not usable, length:", outcome.text.length);
    return json(502, {
      error: "The AI did not return a usable order",
      code: "provider_invalid",
    });
  }
  return json(200, { order });
});
