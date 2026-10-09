import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { RefreshCw, Sparkles } from "lucide-react";

import { AppPageShell } from "@/components/layout/app-page-shell";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { getAiSettingsStatus } from "@/lib/ai/settings-client";
import {
  buildInsightPayload,
  fingerprintPayload,
} from "@/lib/ai/build-insight-payload";
import {
  describeInsightError,
  readInsightErrorBody,
} from "@/lib/ai/insight-errors";
import {
  getCachedInsight,
  isCacheFresh,
  setCachedInsight,
  type CachedInsight,
} from "@/lib/ai/insight-cache";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { formatSyncTime } from "@/lib/time-utils";

type ViewState = "loading" | "offline" | "not-configured" | "ready" | "error";

export default function HomePage() {
  const { t } = useTranslation("home");
  const { t: tNav } = useTranslation("nav");
  const { isAuthed } = useAuth();
  const isOnline = useOnlineStatus();
  const [view, setView] = useState<ViewState>("loading");
  const [insight, setInsight] = useState<CachedInsight | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (fingerprint: string, payload: Record<string, unknown>) => {
      if (!supabase) throw new Error("Sync is not configured for this build.");
      const { data, error: invokeError } = await supabase.functions.invoke(
        "generate-ai-insights",
        { body: payload }
      );
      if (invokeError) {
        // The generic message hides why the function refused; read the body.
        throw new Error(
          describeInsightError(
            await readInsightErrorBody(invokeError),
            invokeError.message,
            t
          )
        );
      }
      if (typeof data?.error === "string") {
        throw new Error(describeInsightError(data, data.error, t));
      }
      const next: CachedInsight = {
        generatedAt: new Date().toISOString(),
        fingerprint,
        summary: typeof data?.summary === "string" ? data.summary : "",
        recommendations: Array.isArray(data?.recommendations)
          ? data.recommendations.filter((r: unknown) => typeof r === "string")
          : [],
      };
      setCachedInsight(next);
      return next;
    },
    [t]
  );

  const load = useCallback(
    async (forceRefresh: boolean) => {
      if (!isSupabaseConfigured) {
        setView("offline");
        return;
      }
      if (!isAuthed) {
        // Signed in on this device but no usable session yet. Offline, that is
        // the whole story. Online it is the first moments of a page load, so keep
        // waiting: the session arrives and this runs again.
        setView(isOnline ? "loading" : "offline");
        return;
      }
      setError(null);
      try {
        const status = await getAiSettingsStatus();
        if (!status.configured) {
          setView("not-configured");
          return;
        }
        const payload = await buildInsightPayload();
        const fingerprint = fingerprintPayload(payload);
        const cached = getCachedInsight();
        if (!forceRefresh && isCacheFresh(cached, fingerprint)) {
          setInsight(cached);
          setView("ready");
          return;
        }
        if (cached) {
          // Show the stale insight immediately while a fresh one loads.
          setInsight(cached);
          setView("ready");
        }
        setRefreshing(true);
        const next = await generate(
          fingerprint,
          payload as unknown as Record<string, unknown>
        );
        setInsight(next);
        setView("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setView((current) => (current === "ready" ? current : "error"));
      } finally {
        setRefreshing(false);
      }
    },
    [isAuthed, isOnline, generate]
  );

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off async insight load on mount */
    void load(false);
  }, [load]);

  return (
    <AppPageShell
      title={t("page.title")}
      titleIcon={<Sparkles className="size-5 text-primary" aria-hidden />}
      subtitle={t("page.subtitle")}
      className="space-y-4"
    >
      {view === "loading" ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("loading")}
        </p>
      ) : null}

      {view === "offline" ? (
        <section className="space-y-2 rounded-xl border p-4" role="status">
          <p className="text-sm font-medium">{t("offline.title")}</p>
          <p className="text-sm text-muted-foreground">
            {t("offline.description")}
          </p>
        </section>
      ) : null}

      {view === "not-configured" ? (
        <section className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">{t("setup.title")}</p>
          <p className="text-sm text-muted-foreground">
            {t("setup.description")}
          </p>
          <Button asChild size="sm">
            <Link to="/settings">{t("setup.cta")}</Link>
          </Button>
        </section>
      ) : null}

      {(view === "ready" || (view === "error" && insight)) && insight ? (
        <>
          <section className="space-y-3 rounded-xl border bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-relaxed">
                {insight.summary}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="smIcon"
                disabled={refreshing}
                onClick={() => void load(true)}
                aria-label={t("insight.refresh")}
                title={t("insight.refresh")}
              >
                <RefreshCw
                  className={refreshing ? "size-3.5 animate-spin" : "size-3.5"}
                  aria-hidden
                />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {refreshing
                ? t("insight.refreshing")
                : t("insight.refreshedAt", {
                    time: formatSyncTime(insight.generatedAt),
                  })}
            </p>
          </section>

          {insight.recommendations.length ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t("insight.recommendationsTitle")}
              </h2>
              {insight.recommendations.map((rec, index) => (
                <div
                  key={`${index}-${rec.slice(0, 24)}`}
                  className="rounded-lg border p-3 text-sm leading-relaxed"
                >
                  {rec}
                </div>
              ))}
            </section>
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            {t("insight.basedOn")}
          </p>
        </>
      ) : null}

      {view === "error" && !insight ? (
        <section className="space-y-3 rounded-xl border border-destructive/40 p-4">
          <p className="text-sm text-destructive">
            {t("error.generic", { error: error ?? "unknown" })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
          >
            {t("insight.refresh")}
          </Button>
        </section>
      ) : null}

      <FloatingBackButton to="/" title={tNav("home")} />
    </AppPageShell>
  );
}
