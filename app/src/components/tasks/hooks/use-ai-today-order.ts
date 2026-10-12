import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Activity } from "@/lib/db/types";
import {
  loadRankRequest,
  pickRankCandidates,
} from "@/lib/ai/build-rank-request";
import {
  RankTodayError,
  requestTodayRanking,
} from "@/lib/ai/rank-today-client";
import {
  clearStoredRanking,
  getStoredRanking,
  isRankingStale,
  setStoredRanking,
  type StoredRanking,
} from "@/lib/ai/today-ranking";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";

interface Params {
  /** Ordering only applies to the real current day. */
  enabled: boolean;
  /** The calendar day being shown, YYYY-MM-DD. */
  today: string;
  activities: readonly Activity[];
  getName: (activity: Activity) => string;
  counts: Readonly<Record<string, number>>;
  streaks: Readonly<Record<string, number>>;
}

export interface AiOrderError {
  message: string;
  code: string | null;
}

const STALE_CHECK_MS = 60_000;

/**
 * "Order with AI" for Today (product-scope.md B2b). The AI only ever runs when
 * the person asks; the result is kept for the day on this device. Without AI,
 * offline, or on any failure the list simply keeps its no-AI order.
 */
export function useAiTodayOrder({
  enabled,
  today,
  activities,
  getName,
  counts,
  streaks,
}: Params) {
  const { t } = useTranslation("today", { keyPrefix: "aiOrder" });
  const isOnline = useOnlineStatus();
  const { isAuthed } = useAuth();
  const [stored, setStored] = useState<StoredRanking | null>(() =>
    getStoredRanking(today)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AiOrderError | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const requestRef = useRef(0);

  // The order belongs to one day: when the day rolls over, read that day's.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-reads the per-day device cache when the day changes
    setStored(getStoredRanking(today));
    setError(null);
  }, [today]);

  useEffect(() => {
    if (!stored) return;
    const timer = window.setInterval(
      () => setNowMs(Date.now()),
      STALE_CHECK_MS
    );
    return () => window.clearInterval(timer);
  }, [stored]);

  const candidates = useMemo(
    () => pickRankCandidates(activities, counts),
    [activities, counts]
  );

  const available = isOnline && isSupabaseConfigured && isAuthed;

  const rank = useCallback(async () => {
    if (!enabled || loading || candidates.length < 2) return;
    if (!available) {
      setError({ message: t("error.offline"), code: "offline" });
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const request = await loadRankRequest({
        candidates: candidates.map((activity) => ({
          ...activity,
          name: getName(activity),
        })),
        today,
        todayCounts: counts,
        streaks,
      });
      const idByKey = new Map(
        request.items.map((item, index) => [item.key, candidates[index].id])
      );
      const order = await requestTodayRanking(request, idByKey, t);
      if (requestId !== requestRef.current) return;
      const next: StoredRanking = {
        date: today,
        generatedAt: new Date().toISOString(),
        order,
      };
      setStoredRanking(next);
      setStored(next);
      setNowMs(Date.now());
    } catch (cause) {
      if (requestId !== requestRef.current) return;
      setError({
        message: cause instanceof Error ? cause.message : String(cause),
        code: cause instanceof RankTodayError ? cause.code : null,
      });
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [
    enabled,
    loading,
    candidates,
    available,
    getName,
    today,
    counts,
    streaks,
    t,
  ]);

  /** Back to the no-AI order. */
  const reset = useCallback(() => {
    requestRef.current += 1;
    clearStoredRanking();
    setStored(null);
    setError(null);
    setLoading(false);
  }, []);

  const candidateIds = useMemo(
    () => candidates.map((activity) => activity.id),
    [candidates]
  );

  const active = enabled ? stored : null;
  const stale = active ? isRankingStale(active, candidateIds, nowMs) : false;
  const ranking = useMemo(() => active?.order.map((row) => row.id), [active]);
  // A reason belongs to a row that is still open; a finished row drops it.
  const reasons = useMemo(() => {
    const open = new Set(candidateIds);
    const map = new Map<string, string>();
    for (const row of active?.order ?? []) {
      if (row.reason && open.has(row.id)) map.set(row.id, row.reason);
    }
    return map;
  }, [active, candidateIds]);

  return {
    /** At least two rows to order, on today. */
    canOrder: enabled && candidates.length >= 2,
    available,
    loading,
    error,
    generatedAt: active?.generatedAt ?? null,
    stale,
    ranking,
    reasons,
    rank,
    reset,
  };
}
