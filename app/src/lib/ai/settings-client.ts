import { supabase } from "@/lib/supabase";

/** Thin client for the save-ai-settings edge function (save / test / status / clear). */
export async function invokeAiSettings(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error("Sync is not configured for this build.");
  const { data, error } = await supabase.functions.invoke("save-ai-settings", {
    body,
  });
  if (error) throw new Error(error.message || "Request failed");
  return data as Record<string, unknown>;
}

export interface AiSettingsStatus {
  configured: boolean;
  baseUrl: string | null;
  model: string | null;
}

export async function getAiSettingsStatus(): Promise<AiSettingsStatus> {
  const data = await invokeAiSettings({ action: "status" });
  return {
    configured: Boolean(data.configured),
    baseUrl: typeof data.baseUrl === "string" ? data.baseUrl : null,
    model: typeof data.model === "string" ? data.model : null,
  };
}
