import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requestCompletion } from "../_shared/chat-completion.ts";
import {
  fingerprintLetter,
  letterHasProse,
  letterSystemPrompt,
  letterUserMessage,
  parseLetter,
  parseLetterRequest,
} from "../_shared/letter.ts";

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

// Shares the daily allowance with insights and Today ordering. The body is the
// week's words, so the cap is larger than the figure-only calls, and it is
// still bounded: seven short days.
const MAX_CALLS_PER_DAY = 20;
const MAX_PAYLOAD_BYTES = 48_000;
const LETTER_TOKEN_CAPS = {
  maxTokens: 700,
  maxCompletionTokens: 1600,
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

function letterBody(result: {
  paragraphs: unknown;
  experiment: unknown;
}): Record<string, unknown> {
  const paragraphs = result.paragraphs as { quotes?: { date: string; quote: string }[] }[];
  const experiment = result.experiment as {
    quotes?: { date: string; quote: string }[];
  } | null;
  const citations = [
    ...paragraphs.flatMap((paragraph) => paragraph.quotes ?? []),
    ...(experiment?.quotes ?? []),
  ];
  return {
    paragraphs: result.paragraphs,
    experiment: result.experiment,
    citations,
    quiet: paragraphs.length === 0 && !experiment,
  };
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
  const letterRequest = parseLetterRequest(body);
  if (!letterRequest) return json(400, { error: "Invalid letter request" });
  const force =
    !!body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    (body as { force?: unknown }).force === true;

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select("journal_reading")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return json(500, { error: "Could not load settings" });
  if (profile?.journal_reading !== true) {
    return json(403, {
      error: "Journal reading is off",
      code: "reading_off",
    });
  }

  const fingerprint = fingerprintLetter(letterRequest);
  if (!force) {
    const { data: existing, error: existingError } = await adminClient
      .from("journal_letters")
      .select("paragraphs, experiment")
      .eq("user_id", user.id)
      .eq("fingerprint", fingerprint)
      .maybeSingle();
    if (existingError) return json(500, { error: "Could not load the letter" });
    if (existing) {
      return json(
        200,
        letterBody({
          paragraphs: existing.paragraphs,
          experiment: existing.experiment,
        }),
      );
    }
  }

  // Nothing written: say so without calling the model or spending the allowance.
  if (!letterHasProse(letterRequest)) {
    return json(200, {
      paragraphs: [],
      experiment: null,
      citations: [],
      quiet: true,
    });
  }

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
      { role: "system", content: letterSystemPrompt(letterRequest.language) },
      { role: "user", content: letterUserMessage(letterRequest) },
    ],
    LETTER_TOKEN_CAPS,
  );
  if (!outcome.ok) return json(outcome.status, outcome.body);

  const { error: updateError } = await adminClient
    .from("user_ai_settings")
    .update({ calls_today: callsToday + 1, calls_reset_at: today })
    .eq("user_id", user.id);
  if (updateError) {
    console.error("Could not update AI call counter:", updateError.message);
  }

  const letter = parseLetter(outcome.text, letterRequest);
  if (!letter) {
    console.error("Journal letter was not usable, length:", outcome.text.length);
    return json(502, {
      error: "The AI did not return a usable letter",
      code: "provider_invalid",
    });
  }

  const stored = letterBody(letter);
  const { error: saveError } = await adminClient.from("journal_letters").upsert(
    {
      user_id: user.id,
      week_start: letterRequest.weekStart,
      fingerprint,
      paragraphs: letter.paragraphs,
      experiment: letter.experiment,
      citations: stored.citations,
    },
    { onConflict: "user_id,fingerprint" },
  );
  if (saveError) {
    console.error("Could not store the letter:", saveError.message);
  }
  return json(200, stored);
});
