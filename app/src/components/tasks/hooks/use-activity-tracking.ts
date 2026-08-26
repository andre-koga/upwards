import { useState, useCallback } from "react";
import { now, newId } from "@/lib/db";
import type { ActivityPeriod, DailyEntry } from "@/lib/db/types";
import { closeOpenPeriods } from "@/lib/activity";
import { clipPeriodToDay } from "@/lib/activity/period-day-utils";
import {
  adoptUntimedPeriodForSession,
  dedupeUntimedCompletionsForDay,
  fetchActivityPeriodsForDay,
} from "@/lib/activity/untimed-period";
import {
  saveTimedPeriod,
  setCurrentActivityLocal,
} from "@/lib/sync/mutate-synced";

export function useActivityTracking(
  dateString: string,
  currentActivityId: string | null,
  setCurrentActivityId: (id: string | null) => void,
  getOrCreateDailyEntry: () => Promise<DailyEntry>
) {
  const [activityPeriods, setActivityPeriods] = useState<ActivityPeriod[]>([]);

  const loadActivityPeriods = useCallback(async () => {
    try {
      await dedupeUntimedCompletionsForDay(dateString);
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
          return total + clipPeriodToDay(startMs, endMs, dateString, nowMs);
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
              total + clipPeriodToDay(startMs, endMs, dateString, liveNowMs)
            );
          }
          if (!includeOpenPeriod) return total;
          return total + clipPeriodToDay(startMs, null, dateString, liveNowMs);
        }, 0);
    },
    [activityPeriods, dateString]
  );

  const handleStartActivity = useCallback(
    async (activityId: string) => {
      if (currentActivityId === activityId) return;
      try {
        const n = now();
        const entry = await getOrCreateDailyEntry();

        await closeOpenPeriods(entry.id);

        const adopted = await adoptUntimedPeriodForSession({
          activityId,
          dateString,
          dailyEntryId: entry.id,
          startIso: n,
          endIso: null,
        });
        if (!adopted) {
          const newPeriod: ActivityPeriod = {
            id: newId(),
            daily_entry_id: entry.id,
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
        }
        await setCurrentActivityLocal(dateString, activityId);

        setCurrentActivityId(activityId);
        await loadActivityPeriods();
      } catch (error) {
        console.error("Error switching activity:", error);
      }
    },
    [
      currentActivityId,
      dateString,
      getOrCreateDailyEntry,
      setCurrentActivityId,
      loadActivityPeriods,
    ]
  );

  const handleStopActivity = useCallback(async () => {
    try {
      const entry = await getOrCreateDailyEntry();

      await closeOpenPeriods(entry.id);

      await setCurrentActivityLocal(dateString, null);

      setCurrentActivityId(null);
      await loadActivityPeriods();
    } catch (error) {
      console.error("Error stopping activity:", error);
    }
  }, [
    getOrCreateDailyEntry,
    setCurrentActivityId,
    loadActivityPeriods,
    dateString,
  ]);

  return {
    activityPeriods,
    loadActivityPeriods,
    calculateActivityTime,
    getActivityElapsedMs,
    handleStartActivity,
    handleStopActivity,
  };
}
