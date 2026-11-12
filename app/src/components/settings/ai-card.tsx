import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "@/hooks/use-online-status";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms";
import {
  dialogPrimaryActionClassName,
  dialogSecondaryActionClassName,
} from "@/components/forms/styles";
import {
  SettingsBlock,
  SettingsGroup,
  SettingsRow,
} from "@/components/settings/settings-list";
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
  const isOnline = useOnlineStatus();
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

  const fieldClass = "bg-background/70 focus-visible:bg-background";
  const ready = Boolean(apiKey && baseUrl && model);

  return (
    <SettingsGroup id="ai" title={t("ai.title")} footer={t("ai.description")}>
      {!isSupabaseConfigured ? (
        <SettingsBlock>
          <p className="text-sm text-muted-foreground">
            {t("ai.syncNotConfigured")}
          </p>
        </SettingsBlock>
      ) : !isAuthed ? (
        // Offline with a login that cannot refresh. Online, the session arrives
        // a moment after load and this branch goes away, so say nothing yet.
        isOnline ? null : (
          <SettingsBlock>
            <p className="text-sm text-muted-foreground">
              {t("ai.needsConnection")}
            </p>
          </SettingsBlock>
        )
      ) : (
        <>
          {status ? (
            <SettingsRow
              icon={Sparkles}
              label={
                status.configured
                  ? t("ai.configuredWith", { model: status.model })
                  : t("ai.notConfigured")
              }
            />
          ) : null}
          <SettingsBlock className="space-y-3">
            <FormField
              id="ai-base-url"
              label={t("ai.baseUrl")}
              value={baseUrl}
              disabled={busy}
              className={fieldClass}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
            />
            <FormField
              id="ai-model"
              label={t("ai.model")}
              value={model}
              disabled={busy}
              className={fieldClass}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
            />
            <FormField
              id="ai-api-key"
              label={t("ai.apiKey")}
              type="password"
              autoComplete="off"
              value={apiKey}
              disabled={busy}
              className={fieldClass}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                status?.configured
                  ? t("ai.apiKeySavedPlaceholder")
                  : t("ai.apiKeyPlaceholder")
              }
            />
            {message ? (
              <p
                role="status"
                className={
                  message.tone === "success"
                    ? "text-xs text-green"
                    : "text-xs text-destructive"
                }
              >
                {message.text}
              </p>
            ) : null}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className={dialogSecondaryActionClassName}
                disabled={busy || !ready}
                onClick={() => void handleTest()}
              >
                {testing ? t("ai.testing") : t("ai.testConnection")}
              </Button>
              <Button
                type="button"
                className={dialogPrimaryActionClassName}
                disabled={busy || !ready}
                onClick={() => void handleSave()}
              >
                {saving ? t("ai.saving") : t("ai.save")}
              </Button>
            </div>
          </SettingsBlock>
        </>
      )}
    </SettingsGroup>
  );
}
