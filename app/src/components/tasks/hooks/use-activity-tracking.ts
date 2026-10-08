import { useState, useCallback, useMemo } from "react";
import { db, now, newId } from "@/lib/db";
import type { ActivityPeriod } from "@/lib/db/types";
import {
  closeOpenPeriods,
  fetchActivityPeriodsForDay,
} from "@/lib/activity/periods";
import { activityTracksTime } from "@/lib/activity/tracks-time";
import { sessionShareOfDay } from "@/lib/activity/period-day-utils";
import { saveTimedPeriod } from "@/lib/sync/mutate-synced";

export function useActivityTracking(dateString: string) {
  const [activityPeriods, setActivityPeriods] = useState<ActivityPeriod[]>([]);

  /**
   * What is running is whatever session has no end time. Nothing else records
   * it, so it cannot disagree with the sessions themselves.
   */
  const currentActivityId = useMemo(() => {
    const open = activityPeriods.filter((period) => !period.end_time);
    if (open.length === 0) return null;
    return open.reduce((latest, period) =>
      new Date(period.start_time).getTime() >
      new Date(latest.start_time).getTime()
        ? period
        : latest
    ).activity_id;
  }, [activityPeriods]);

  const loadActivityPeriods = useCallback(async () => {
    try {
      const periods = await fetchActivityPeriodsForDay(dateString);
      setActivityPeriods(periods);
    } catch (error) {
      console.error("Error loading activity periods:", error);
    }
  }, [dateString]);

  /** Time an activity contributed to THIS effective day (closed periods only). */
  const calculateActivityTime = useCallback(
    (activityId: string): number => {
      const nowMs = Date.now();
      return activityPeriods
        .filter((p) => p.activity_id === activityId && !!p.end_time)
        .reduce((total, period) => {
          const startMs = new Date(period.start_time).getTime();
          const endMs = new Date(period.end_time!).getTime();
          return total + sessionShareOfDay(startMs, endMs, dateString, nowMs);
        }, 0);
    },
    [activityPeriods, dateString]
  );

  /** Total ms an activity contributed to THIS effective day, optionally
   *  including the live open period. */
  const getActivityElapsedMs = useCallback(
    (
      activityId: string,
      options?: { includeOpenPeriod?: boolean; nowMs?: number }
    ): number => {
      const includeOpenPeriod = options?.includeOpenPeriod ?? false;
      const liveNowMs = options?.nowMs ?? Date.now();

      return activityPeriods
        .filter((period) => period.activity_id === activityId)
        .reduce((total, period) => {
          const startMs = new Date(period.start_time).getTime();
          if (period.end_time) {
            const endMs = new Date(period.end_time).getTime();
            return (
              total + sessionShareOfDay(startMs, endMs, dateString, liveNowMs)
            );
          }
          if (!includeOpenPeriod) return total;
          return (
            total + sessionShareOfDay(startMs, null, dateString, liveNowMs)
          );
        }, 0);
    },
    [activityPeriods, dateString]
  );

  const handleStartActivity = useCallback(
    async (activityId: string) => {
      if (currentActivityId === activityId) return;
      try {
        // Check-only activities have no timer, whichever control asked.
        const activity = await db.activities.get(activityId);
        if (!activityTracksTime(activity)) return;

        const n = now();
        await closeOpenPeriods();

        const newPeriod: ActivityPeriod = {
          id: newId(),
          activity_id: activityId,
          start_time: n,
          end_time: null,
          note: null,
          created_at: n,
          updated_at: n,
          synced_at: null,
          deleted_at: null,
        };
        await saveTimedPeriod(newPeriod);
        await loadActivityPeriods();
      } catch (error) {
        console.error("Error switching activity:", error);
      }
    },
    [currentActivityId, loadActivityPeriods]
  );

  const handleStopActivity = useCallback(async () => {
    try {
      await closeOpenPeriods();
      await loadActivityPeriods();
    } catch (error) {
      console.error("Error stopping activity:", error);
    }
  }, [loadActivityPeriods]);

  return {
    currentActivityId,
    activityPeriods,
    loadActivityPeriods,
    calculateActivityTime,
    getActivityElapsedMs,
    handleStartActivity,
    handleStopActivity,
  };
}
