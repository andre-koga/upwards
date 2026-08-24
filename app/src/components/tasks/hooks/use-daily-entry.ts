import { useState, useCallback, useRef } from "react";
import { db, now, newId } from "@/lib/db";
import { getOrCreateDailyEntry as getOrCreateDailyEntryDb } from "@/lib/db/daily-entry";
import type { DailyEntry } from "@/lib/db/types";
import {
  refreshActivityStreakProjectionForActivity,
  refreshActivityStreakProjectionFromDate,
} from "@/lib/streak-utils";
import {
  enqueueActivityCountDelta,
  enqueueActivityPauseChange,
  enqueueBreakDayChange,
} from "@/lib/sync/semantic-operations";

function normalizeTaskCounts(entry: DailyEntry | null): Record<string, number> {
  return (entry?.task_counts as Record<string, number>) || {};
}

function normalizePausedTaskIds(entry: DailyEntry | null): string[] {
  return Array.isArray(entry?.paused_task_ids) ? entry.paused_task_ids : [];
}

function normalizeBreakDay(entry: DailyEntry | null): boolean {
  return Boolean(entry?.is_break_day);
}

export function useDailyEntry(dateString: string) {
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [pausedTaskIds, setPausedTaskIds] = useState<string[]>([]);
  const [isBreakDay, setIsBreakDay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(
    null
  );
  const [streakDbVersion, setStreakDbVersion] = useState(0);

  // Refs let us compute the exact next persisted values without relying on
  // React state updater callbacks having run before awaiting persistence.
  // They are written inside async/event callbacks only — never during render.
  const taskCountsRef = useRef(taskCounts);
  const pausedTaskIdsRef = useRef(pausedTaskIds);

  const bumpStreakDbVersion = useCallback(() => {
    setStreakDbVersion((v) => v + 1);
  }, []);

  const refreshStreakProjection = useCallback(
    (activityId: string) => {
      void refreshActivityStreakProjectionForActivity(
        activityId,
        new Date(dateString + "T00:00:00")
      ).then(() => {
        bumpStreakDbVersion();
      });
    },
    [bumpStreakDbVersion, dateString]
  );

  const refreshAllStreakProjections = useCallback(() => {
    void db.activities
      .filter(
        (activity) => !activity.deleted_at && activity.routine !== "anytime"
      )
      .toArray()
      .then((activities) =>
        refreshActivityStreakProjectionFromDate(
          activities,
          new Date(dateString + "T00:00:00")
        )
      )
      .then(() => {
        bumpStreakDbVersion();
      });
  }, [bumpStreakDbVersion, dateString]);

  const loadDailyEntry = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      try {
        if (!silent) setLoading(true);
        const entry = await db.dailyEntries
          .where("date")
          .equals(dateString)
          .filter((e) => !e.deleted_at)
          .first();

        const nextCounts = normalizeTaskCounts(entry ?? null);
        const nextPausedTaskIds = normalizePausedTaskIds(entry ?? null);
        setDailyEntry(entry || null);
        setTaskCounts(nextCounts);
        setPausedTaskIds(nextPausedTaskIds);
        setIsBreakDay(normalizeBreakDay(entry ?? null));
        setCurrentActivityId(entry?.current_activity_id || null);
        taskCountsRef.current = nextCounts;
        pausedTaskIdsRef.current = nextPausedTaskIds;
      } catch (error) {
        console.error("Error loading daily entry:", error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [dateString]
  );

  const getOrCreateDailyEntry = useCallback(async (): Promise<DailyEntry> => {
    const entry = await getOrCreateDailyEntryDb(dateString);
    const nextCounts = normalizeTaskCounts(entry);
    const nextPausedTaskIds = normalizePausedTaskIds(entry);
    setDailyEntry(entry);
    setTaskCounts(nextCounts);
    setPausedTaskIds(nextPausedTaskIds);
    setIsBreakDay(normalizeBreakDay(entry));
    taskCountsRef.current = nextCounts;
    pausedTaskIdsRef.current = nextPausedTaskIds;
    return entry;
  }, [dateString]);

  const persistTaskCountsAndPaused = useCallback(
    async (
      newCounts: Record<string, number>,
      newPausedTaskIds: string[]
    ): Promise<void> => {
      try {
        const entry = await db.dailyEntries
          .where("date")
          .equals(dateString)
          .filter((e) => !e.deleted_at)
          .first();
        if (entry) {
          await db.dailyEntries.update(entry.id, {
            task_counts: newCounts,
            paused_task_ids: newPausedTaskIds,
            updated_at: now(),
          });
          setDailyEntry({
            ...entry,
            task_counts: newCounts,
            paused_task_ids: newPausedTaskIds,
            updated_at: now(),
          });
        } else {
          const n = now();
          const newDbEntry: DailyEntry = {
            id: newId(),
            date: dateString,
            task_counts: newCounts,
            paused_task_ids: newPausedTaskIds,
            is_break_day: false,
            current_activity_id: null,
            created_at: n,
            updated_at: n,
            synced_at: null,
            deleted_at: null,
          };
          await db.dailyEntries.add(newDbEntry);
          setDailyEntry(newDbEntry);
        }
      } catch (err) {
        console.error("Error persisting task count:", err);
        loadDailyEntry();
      }
    },
    [dateString, loadDailyEntry]
  );

  const incrementTask = useCallback(
    async (
      activityId: string,
      target: number,
      options?: { neverSlip?: boolean }
    ) => {
      const neverSlip = options?.neverSlip ?? false;
      const prevCounts = taskCountsRef.current;
      const prevPausedTaskIds = pausedTaskIdsRef.current;

      const current = prevCounts[activityId] || 0;
      const nextCount = neverSlip
        ? current + 1
        : current >= target
          ? 0
          : current + 1;

      const nextCounts: Record<string, number> = { ...prevCounts };
      if (neverSlip) {
        nextCounts[activityId] = nextCount;
      } else if (nextCount === 0) {
        delete nextCounts[activityId];
      } else {
        nextCounts[activityId] = nextCount;
      }

      const nextPausedTaskIds = prevPausedTaskIds.filter(
        (id) => id !== activityId
      );

      // Update local UI immediately and keep refs in sync so rapid clicks behave
      // consistently (and persistence uses the same values).
      taskCountsRef.current = nextCounts;
      pausedTaskIdsRef.current = nextPausedTaskIds;
      setTaskCounts(nextCounts);
      setPausedTaskIds(nextPausedTaskIds);

      await persistTaskCountsAndPaused(nextCounts, nextPausedTaskIds);
      void enqueueActivityCountDelta({
        activityId,
        date: dateString,
        previousCount: current,
        nextCount: nextCounts[activityId] || 0,
        reason: neverSlip
          ? "never_slip"
          : nextCount === 0
            ? "cycle"
            : "increment",
      });
      refreshStreakProjection(activityId);
      return { previousCount: current, nextCount: nextCounts[activityId] || 0 };
    },
    [dateString, persistTaskCountsAndPaused, refreshStreakProjection]
  );

  const resetNeverTaskCount = useCallback(
    async (activityId: string) => {
      const prevCounts = taskCountsRef.current;
      const prevPausedTaskIds = pausedTaskIdsRef.current;
      const previousCount = prevCounts[activityId] || 0;

      const nextCounts: Record<string, number> = { ...prevCounts };
      delete nextCounts[activityId];

      const nextPausedTaskIds = prevPausedTaskIds.filter(
        (id) => id !== activityId
      );

      taskCountsRef.current = nextCounts;
      pausedTaskIdsRef.current = nextPausedTaskIds;
      setTaskCounts(nextCounts);
      setPausedTaskIds(nextPausedTaskIds);

      await persistTaskCountsAndPaused(nextCounts, nextPausedTaskIds);
      void enqueueActivityCountDelta({
        activityId,
        date: dateString,
        previousCount,
        nextCount: 0,
        reason: "reset",
      });
      refreshStreakProjection(activityId);
    },
    [dateString, persistTaskCountsAndPaused, refreshStreakProjection]
  );

  const toggleTaskPaused = useCallback(
    async (activityId: string) => {
      const prevPausedTaskIds = pausedTaskIdsRef.current;
      const wasPaused = prevPausedTaskIds.includes(activityId);
      const nextPausedTaskIds = wasPaused
        ? prevPausedTaskIds.filter((id) => id !== activityId)
        : [...prevPausedTaskIds, activityId];

      pausedTaskIdsRef.current = nextPausedTaskIds;
      setPausedTaskIds(nextPausedTaskIds);

      try {
        const entry = await db.dailyEntries
          .where("date")
          .equals(dateString)
          .filter((e) => !e.deleted_at)
          .first();

        if (entry) {
          await db.dailyEntries.update(entry.id, {
            paused_task_ids: nextPausedTaskIds,
            updated_at: now(),
          });
          setDailyEntry({
            ...entry,
            paused_task_ids: nextPausedTaskIds,
            updated_at: now(),
          });
          void enqueueActivityPauseChange({
            activityId,
            date: dateString,
            paused: !wasPaused,
          });
          refreshStreakProjection(activityId);
          return;
        }

        const n = now();
        const newDbEntry: DailyEntry = {
          id: newId(),
          date: dateString,
          task_counts: taskCountsRef.current,
          paused_task_ids: nextPausedTaskIds,
          is_break_day: false,
          current_activity_id: null,
          created_at: n,
          updated_at: n,
          synced_at: null,
          deleted_at: null,
        };
        await db.dailyEntries.add(newDbEntry);
        setDailyEntry(newDbEntry);
        void enqueueActivityPauseChange({
          activityId,
          date: dateString,
          paused: !wasPaused,
        });
        refreshStreakProjection(activityId);
      } catch (error) {
        console.error("Error toggling paused task:", error);
        loadDailyEntry();
      }
    },
    [dateString, loadDailyEntry, refreshStreakProjection]
  );

  const toggleBreakDay = useCallback(async () => {
    const nextIsBreakDay = !isBreakDay;
    setIsBreakDay(nextIsBreakDay);

    try {
      const entry = await db.dailyEntries
        .where("date")
        .equals(dateString)
        .filter((e) => !e.deleted_at)
        .first();

      if (entry) {
        await db.dailyEntries.update(entry.id, {
          is_break_day: nextIsBreakDay,
          updated_at: now(),
        });
        setDailyEntry({
          ...entry,
          is_break_day: nextIsBreakDay,
          updated_at: now(),
        });
        void enqueueBreakDayChange({
          date: dateString,
          isBreakDay: nextIsBreakDay,
          dailyEntryId: entry.id,
        });
        refreshAllStreakProjections();
        return;
      }

      const n = now();
      const newDbEntry: DailyEntry = {
        id: newId(),
        date: dateString,
        task_counts: {},
        paused_task_ids: [],
        is_break_day: nextIsBreakDay,
        current_activity_id: null,
        created_at: n,
        updated_at: n,
        synced_at: null,
        deleted_at: null,
      };
      await db.dailyEntries.add(newDbEntry);
      setDailyEntry(newDbEntry);
      void enqueueBreakDayChange({
        date: dateString,
        isBreakDay: nextIsBreakDay,
        dailyEntryId: newDbEntry.id,
      });
      refreshAllStreakProjections();
    } catch (error) {
      console.error("Error toggling break day:", error);
      loadDailyEntry();
    }
  }, [dateString, isBreakDay, loadDailyEntry, refreshAllStreakProjections]);

  return {
    dailyEntry,
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    loading,
    currentActivityId,
    setCurrentActivityId,
    loadDailyEntry,
    getOrCreateDailyEntry,
    incrementTask,
    resetNeverTaskCount,
    toggleTaskPaused,
    toggleBreakDay,
    streakDbVersion,
    bumpStreakDbVersion,
  };
}
