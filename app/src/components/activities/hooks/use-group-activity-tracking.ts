import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { getOrCreateDailyEntry } from "@/lib/db/daily-entry";
import { todayDateString } from "@/lib/time-utils";
import { useActivityTracking } from "@/components/tasks/hooks/use-activity-tracking";

export function useGroupActivityTracking() {
  const dateString = todayDateString();
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(
    null
  );
  const [allPeriods, setAllPeriods] = useState<
    Array<{
      id: string;
      activity_id: string;
      start_time: string;
      end_time: string | null;
    }>
  >([]);
  const loadAllPeriods = useCallback(async () => {
    try {
      const periods = await db.activityPeriods
        .filter((period) => !period.deleted_at)
        .toArray();

      setAllPeriods(
        periods.map((period) => ({
          id: period.id,
          activity_id: period.activity_id,
          start_time: period.start_time,
          end_time: period.end_time,
        }))
      );
    } catch (error) {
      console.error("Error loading activity periods:", error);
    }
  }, []);

  const getOrCreateDailyEntryForDate = useCallback(
    async () => getOrCreateDailyEntry(dateString),
    [dateString]
  );

  const { handleStartActivity, handleStopActivity, loadActivityPeriods } =
    useActivityTracking(
      dateString,
      currentActivityId,
      setCurrentActivityId,
      getOrCreateDailyEntryForDate
    );

  useEffect(() => {
    const loadCurrentActivity = async () => {
      try {
        const entry = await db.dailyEntries
          .where("date")
          .equals(dateString)
          .filter((dailyEntry) => !dailyEntry.deleted_at)
          .first();

        setCurrentActivityId(entry?.current_activity_id ?? null);
        await loadActivityPeriods();
        await loadAllPeriods();
      } catch (error) {
        console.error("Error loading current activity:", error);
      }
    };

    loadCurrentActivity();
  }, [dateString, loadActivityPeriods, loadAllPeriods]);

  const toggleActivity = useCallback(
    async (activityId: string) => {
      if (currentActivityId === activityId) {
        await handleStopActivity();
        await loadAllPeriods();
        return;
      }

      await handleStartActivity(activityId);
      await loadAllPeriods();
    },
    [currentActivityId, handleStartActivity, handleStopActivity, loadAllPeriods]
  );

  const getElapsedMs = useCallback(
    (activityId: string): number => {
      const periods = allPeriods.filter(
        (period) => period.activity_id === activityId && !!period.end_time
      );
      return periods.reduce((total, period) => {
        const start = new Date(period.start_time).getTime();
        const end = new Date(period.end_time!).getTime();
        return total + (end - start);
      }, 0);
    },
    [allPeriods]
  );

  return {
    currentActivityId,
    getElapsedMs,
    toggleActivity,
  };
}
