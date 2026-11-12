import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requestCompletion } from "../_shared/chat-completion.ts";
import {
  MAX_DAYS,
  MAX_TEXT_CHARS,
  MAX_TITLE_CHARS,
  parseReading,
  parseReadingRequest,
  readingSystemPrompt,
  readingUserMessage,
} from "../_shared/journal-personality.ts";

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

// A per-user daily call counter, so a buggy client cannot burn through
// someone's key budget. Shared with the other AI calls via user_ai_settings.
const MAX_CALLS_PER_DAY = 20;
// MAX_DAYS entries of date + title + text, plus JSON quoting. The body is
// untrusted client input.
const MAX_PAYLOAD_BYTES = MAX_DAYS * (MAX_TEXT_CHARS + MAX_TITLE_CHARS + 80);
// Five traits of score + one note + up to two quotes. `max_completion_tokens`
// also counts hidden reasoning, so its ceiling sits well above the answer.
const READING_TOKEN_CAPS = { maxTokens: 1500, maxCompletionTokens: 6000 };

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
  const readingRequest = parseReadingRequest(body);
  if (!readingRequest) return json(400, { error: "Invalid reading request" });

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
      { role: "system", content: readingSystemPrompt(readingRequest.locale) },
      { role: "user", content: readingUserMessage(readingRequest) },
    ],
    READING_TOKEN_CAPS,
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

  const reading = parseReading(outcome.text);
  if (!reading) {
    console.error("AI reading was not usable, length:", outcome.text.length);
    return json(502, {
      error: "The AI did not return a usable reading",
      code: "provider_invalid",
    });
  }
  // Quotes are not checked here. The client holds the days it sent and keeps a
  // quote only if it is an exact substring of one of them.
  return json(200, { reading });
});
