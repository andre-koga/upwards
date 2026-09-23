import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/forms";
import { SettingsSection } from "@/components/ui/settings-section";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import {
  getAiSettingsStatus,
  invokeAiSettings,
  type AiSettingsStatus,
} from "@/lib/ai/settings-client";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

export function AiCard() {
  const { t } = useTranslation("settings");
  const { isAuthed } = useAuth();
  const [status, setStatus] = useState<AiSettingsStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isAuthed) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with auth state */
      setStatus(null);
      return;
    }
    let cancelled = false;
    setLoadingStatus(true);
    getAiSettingsStatus()
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        if (next.baseUrl) setBaseUrl(next.baseUrl);
        if (next.model) setModel(next.model);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  const handleTest = async () => {
    setMessage(null);
    setTesting(true);
    try {
      const data = await invokeAiSettings({
        action: "test",
        baseUrl,
        model,
        apiKey,
      });
      if (data.ok) {
        setMessage({ tone: "success", text: t("ai.testSuccess") });
      } else {
        setMessage({
          tone: "error",
          text: t("ai.testFailure", {
            error: typeof data.error === "string" ? data.error : "unknown",
          }),
        });
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("ai.testFailure", {
          error: error instanceof Error ? error.message : "unknown",
        }),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      await invokeAiSettings({ action: "save", baseUrl, model, apiKey });
      setStatus({ configured: true, baseUrl, model });
      setApiKey("");
      setMessage({ tone: "success", text: t("ai.saveSuccess") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("ai.saveFailure", {
          error: error instanceof Error ? error.message : "unknown",
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || testing || loadingStatus;

  return (
    <SettingsSection
      title={t("ai.title")}
      icon={Sparkles}
      description={t("ai.description")}
    >
      {!isSupabaseConfigured ? (
        <p className="text-sm text-muted-foreground">
          {t("ai.syncNotConfigured")}
        </p>
      ) : !isAuthed ? (
        <p className="text-sm text-muted-foreground">{t("ai.notSignedIn")}</p>
      ) : (
        <>
          {status ? (
            <p className="text-xs text-muted-foreground">
              {status.configured
                ? t("ai.configuredWith", { model: status.model })
                : t("ai.notConfigured")}
            </p>
          ) : null}
          <div className="space-y-2">
            <FormField
              id="ai-base-url"
              label={t("ai.baseUrl")}
              value={baseUrl}
              disabled={busy}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
            />
            <FormField
              id="ai-model"
              label={t("ai.model")}
              value={model}
              disabled={busy}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
            />
            <div className="space-y-1.5">
              <Label htmlFor="ai-api-key">{t("ai.apiKey")}</Label>
              <FormField
                id="ai-api-key"
                label=""
                labelClassName="sr-only"
                type="password"
                autoComplete="off"
                value={apiKey}
                disabled={busy}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  status?.configured
                    ? t("ai.apiKeySavedPlaceholder")
                    : t("ai.apiKeyPlaceholder")
                }
              />
            </div>
          </div>
          {message ? (
            <p
              className={
                message.tone === "success"
                  ? "text-xs text-green-600 dark:text-green-500"
                  : "text-xs text-destructive"
              }
            >
              {message.text}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy || !apiKey || !baseUrl || !model}
              onClick={() => void handleTest()}
            >
              {testing ? t("ai.testing") : t("ai.testConnection")}
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={busy || !apiKey || !baseUrl || !model}
              onClick={() => void handleSave()}
            >
              {saving ? t("ai.saving") : t("ai.save")}
            </Button>
          </div>
        </>
      )}
    </SettingsSection>
  );
}
