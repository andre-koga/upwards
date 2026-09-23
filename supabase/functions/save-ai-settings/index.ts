import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    "Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY"
  );
}

// Cheap connection probe: list models rather than spend tokens on a completion.
const TEST_TIMEOUT_MS = 8000;
const MAX_URL_LENGTH = 500;
const MAX_MODEL_LENGTH = 200;
const MAX_KEY_LENGTH = 500;

interface RequestPayload {
  action?: unknown;
  baseUrl?: unknown;
  model?: unknown;
  apiKey?: unknown;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

function normalizeBaseUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
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

  let payload: RequestPayload;
  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const action = typeof payload.action === "string" ? payload.action : "";
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  if (action === "status") {
    const { data, error } = await adminClient
      .from("user_ai_settings")
      .select("base_url, model")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return json(500, { error: "Could not load AI settings" });
    return json(200, {
      configured: Boolean(data),
      baseUrl: data?.base_url ?? null,
      model: data?.model ?? null,
    });
  }

  if (action === "clear") {
    const { error } = await adminClient
      .from("user_ai_settings")
      .delete()
      .eq("user_id", user.id);
    if (error) return json(500, { error: "Could not remove AI settings" });
    return json(200, { ok: true });
  }

  if (action !== "save" && action !== "test") {
    return json(400, { error: "Unknown action" });
  }

  const rawBaseUrl =
    typeof payload.baseUrl === "string" ? payload.baseUrl : "";
  const model = typeof payload.model === "string" ? payload.model.trim() : "";
  const apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";

  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  if (!baseUrl) return json(400, { error: "Enter a valid base URL" });
  if (!model || model.length > MAX_MODEL_LENGTH) {
    return json(400, { error: "Enter a model name" });
  }
  if (!apiKey || apiKey.length > MAX_KEY_LENGTH) {
    return json(400, { error: "Enter an API key" });
  }

  if (action === "test") {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        return json(200, {
          ok: false,
          error: `Provider returned ${response.status}`,
        });
      }
      return json(200, { ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      return json(200, { ok: false, error: message });
    }
  }

  // action === "save"
  const { error: upsertError } = await adminClient
    .from("user_ai_settings")
    .upsert(
      {
        user_id: user.id,
        base_url: baseUrl,
        model,
        api_key: apiKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (upsertError) {
    console.error("user_ai_settings upsert failed:", upsertError.message);
    return json(500, { error: "Could not save AI settings" });
  }

  return json(200, { ok: true, baseUrl, model });
});
