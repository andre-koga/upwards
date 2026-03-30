import { useState, useCallback } from "react";
import { db, now, newId } from "@/lib/db";
import type { ActivityPeriod, DailyEntry } from "@/lib/db/types";
import { closeOpenPeriods } from "@/lib/activity";

export function useActivityTracking(
  dateString: string,
  currentActivityId: string | null,
  setCurrentActivityId: (id: string | null) => void,
  getOrCreateDailyEntry: () => Promise<DailyEntry>
) {
  const [activityPeriods, setActivityPeriods] = useState<ActivityPeriod[]>([]);

  const loadActivityPeriods = useCallback(async () => {
    try {
      const entry = await db.dailyEntries
        .where("date")
        .equals(dateString)
        .filter((e) => !e.deleted_at)
        .first();

      if (!entry) {
        setActivityPeriods([]);
        return;
      }

      const periods = await db.activityPeriods
        .where("daily_entry_id")
        .equals(entry.id)
        .filter((p) => !p.deleted_at)
        .sortBy("start_time");

      setActivityPeriods(periods);
    } catch (error) {
      console.error("Error loading activity periods:", error);
    }
  }, [dateString]);

  const calculateActivityTime = useCallback(
    (activityId: string): number => {
      const periods = activityPeriods.filter(
        (p) => p.activity_id === activityId && !!p.end_time
      );
      return periods.reduce((total, period) => {
        const start = new Date(period.start_time).getTime();
        const end = new Date(period.end_time!).getTime();
        return total + (end - start);
      }, 0);
    },
    [activityPeriods]
  );

  const handleStartActivity = useCallback(
    async (activityId: string) => {
      if (currentActivityId === activityId) return;
      try {
        const n = now();
        const entry = await getOrCreateDailyEntry();

        await closeOpenPeriods(entry.id);

        const newPeriod: ActivityPeriod = {
          id: newId(),
          daily_entry_id: entry.id,
          activity_id: activityId,
          start_time: n,
          end_time: null,
          created_at: n,
          updated_at: n,
          synced_at: null,
          deleted_at: null,
        };
        await db.activityPeriods.add(newPeriod);
        await db.dailyEntries.update(entry.id, {
          current_activity_id: activityId,
          updated_at: n,
        });

        setCurrentActivityId(activityId);
        await loadActivityPeriods();
      } catch (error) {
        console.error("Error switching activity:", error);
      }
    },
    [
      currentActivityId,
      getOrCreateDailyEntry,
      setCurrentActivityId,
      loadActivityPeriods,
    ]
  );

  const handleStopActivity = useCallback(async () => {
    try {
      const n = now();
      const entry = await getOrCreateDailyEntry();

      await closeOpenPeriods(entry.id);

      await db.dailyEntries.update(entry.id, {
        current_activity_id: null,
        updated_at: n,
      });

      setCurrentActivityId(null);
      await loadActivityPeriods();
    } catch (error) {
      console.error("Error stopping activity:", error);
    }
  }, [getOrCreateDailyEntry, setCurrentActivityId, loadActivityPeriods]);

  return {
    activityPeriods,
    loadActivityPeriods,
    calculateActivityTime,
    handleStartActivity,
    handleStopActivity,
  };
}
