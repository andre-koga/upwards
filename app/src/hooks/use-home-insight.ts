import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getAiSettingsStatus } from "@/lib/ai/settings-client";
import {
  buildInsightPayload,
  fingerprintPayload,
} from "@/lib/ai/build-insight-payload";
import {
  InsightRequestError,
  describeInsightError,
  readInsightErrorBody,
} from "@/lib/ai/insight-errors";
import {
  getCachedInsight,
  isCacheFresh,
  setCachedInsight,
  type CachedInsight,
} from "@/lib/ai/insight-cache";

/**
 * Where the insight stands. Every one of these has a screen: the app is fully
 * usable with no key, no connection, or no answer
 * (design-and-branding.md §4.3).
 */
type InsightPhase =
  | "loading"
  | "offline"
  | "not-configured"
  | "ready"
  | "error";

/** Why the insight on screen is not a fresh one, or why there is none. */
export type InsightNotice =
  | { kind: "offline" }
  | { kind: "rate-limited"; message: string }
  | { kind: "error"; message: string };

export interface HomeInsight {
  phase: InsightPhase;
  /** The insight to show: fresh, or the last good one while a new one loads or fails. */
  insight: CachedInsight | null;
  /** True when `insight` was made from older numbers, or is over a day old. */
  stale: boolean;
  refreshing: boolean;
  notice: InsightNotice | null;
  /** Ask for a new insight now, even if the cached one is still fresh. */
  refresh: () => void;
}

export function useHomeInsight(): HomeInsight {
  const { t } = useTranslation("home");
  const { isAuthed } = useAuth();
  const isOnline = useOnlineStatus();
  const [phase, setPhase] = useState<InsightPhase>("loading");
  const [insight, setInsight] = useState<CachedInsight | null>(null);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<InsightNotice | null>(null);
  // A newer load supersedes an older one still in flight.
  const latest = useRef(0);

  const generate = useCallback(
    async (
      fingerprint: string,
      payload: Record<string, unknown>
    ): Promise<CachedInsight> => {
      if (!supabase) throw new InsightRequestError(t("error.offline"), null);
      const { data, error } = await supabase.functions.invoke(
        "generate-ai-insights",
        { body: payload }
      );
      if (error) {
        // The generic message hides why the function refused; read the body.
        const body = await readInsightErrorBody(error);
        throw new InsightRequestError(
          describeInsightError(body, error.message, t),
          body?.code ?? null
        );
      }
      if (typeof data?.error === "string") {
        throw new InsightRequestError(
          describeInsightError(data, data.error, t),
          typeof data.code === "string" ? data.code : null
        );
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
      const run = ++latest.current;
      const isCurrent = () => run === latest.current;
      const cached = getCachedInsight();

      if (!isSupabaseConfigured || !isOnline) {
        // Insights are made through the account, so they need a connection. The
        // last good one is still worth showing, marked as older.
        setNotice({ kind: "offline" });
        setInsight(cached);
        setStale(Boolean(cached));
        setPhase(cached ? "ready" : "offline");
        return;
      }
      if (!isAuthed) {
        // Online, signed in on this device, but no usable session yet: the
        // first moments of a page load. Keep waiting; the session arrives and
        // this runs again.
        setPhase("loading");
        return;
      }

      setNotice(null);
      try {
        const status = await getAiSettingsStatus();
        if (!isCurrent()) return;
        if (!status.configured) {
          setInsight(null);
          setPhase("not-configured");
          return;
        }
        const payload = await buildInsightPayload();
        const fingerprint = fingerprintPayload(payload);
        if (!forceRefresh && isCacheFresh(cached, fingerprint)) {
          setInsight(cached);
          setStale(false);
          setPhase("ready");
          return;
        }
        if (cached) {
          // Show the older insight at once, marked as such, while a new one loads.
          setInsight(cached);
          setStale(!isCacheFresh(cached, fingerprint));
          setPhase("ready");
        }
        setRefreshing(true);
        const next = await generate(
          fingerprint,
          payload as unknown as Record<string, unknown>
        );
        if (!isCurrent()) return;
        setInsight(next);
        setStale(false);
        setPhase("ready");
      } catch (error) {
        if (!isCurrent()) return;
        const message = error instanceof Error ? error.message : "";
        const code = error instanceof InsightRequestError ? error.code : null;
        setNotice(
          code === "rate_limited"
            ? { kind: "rate-limited", message }
            : { kind: "error", message }
        );
        // Keep whatever insight is already showing; otherwise this is an error screen.
        setPhase((current) => (current === "ready" ? current : "error"));
      } finally {
        if (isCurrent()) setRefreshing(false);
      }
    },
    [isAuthed, isOnline, generate]
  );

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off async insight load on mount */
    void load(false);
  }, [load]);

  const refresh = useCallback(() => void load(true), [load]);

  return { phase, insight, stale, refreshing, notice, refresh };
}
