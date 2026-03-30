import { useState, useCallback, useRef } from "react";
import { db, now, newId } from "@/lib/db";
import { getOrCreateDailyEntry as getOrCreateDailyEntryDb } from "@/lib/db/daily-entry";
import type { DailyEntry } from "@/lib/db/types";

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
  // Bumps whenever we successfully persist task/break-day changes to IndexedDB.
  // Used to trigger downstream computations that read from the DB (e.g. streaks).
  const [streakDbVersion, setStreakDbVersion] = useState(0);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(
    null
  );

  // Refs let us compute the exact next persisted values without relying on
  // React state updater callbacks having run before awaiting persistence.
  const taskCountsRef = useRef(taskCounts);
  const pausedTaskIdsRef = useRef(pausedTaskIds);
  taskCountsRef.current = taskCounts;
  pausedTaskIdsRef.current = pausedTaskIds;

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

        setDailyEntry(entry || null);
        setTaskCounts(normalizeTaskCounts(entry ?? null));
        setPausedTaskIds(normalizePausedTaskIds(entry ?? null));
        setIsBreakDay(normalizeBreakDay(entry ?? null));
        setCurrentActivityId(entry?.current_activity_id || null);
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
    setDailyEntry(entry);
    setTaskCounts(normalizeTaskCounts(entry));
    setPausedTaskIds(normalizePausedTaskIds(entry));
    setIsBreakDay(normalizeBreakDay(entry));
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
          setStreakDbVersion((v) => v + 1);
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
          setStreakDbVersion((v) => v + 1);
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
    },
    [persistTaskCountsAndPaused]
  );

  const resetNeverTaskCount = useCallback(
    async (activityId: string) => {
      const prevCounts = taskCountsRef.current;
      const prevPausedTaskIds = pausedTaskIdsRef.current;

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
    },
    [persistTaskCountsAndPaused]
  );

  const toggleTaskPaused = useCallback(
    async (activityId: string) => {
      const prevPausedTaskIds = pausedTaskIdsRef.current;
      const nextPausedTaskIds = prevPausedTaskIds.includes(activityId)
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
          setStreakDbVersion((v) => v + 1);
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
        setStreakDbVersion((v) => v + 1);
      } catch (error) {
        console.error("Error toggling paused task:", error);
        loadDailyEntry();
      }
    },
    [dateString, loadDailyEntry]
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
        setStreakDbVersion((v) => v + 1);
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
      setStreakDbVersion((v) => v + 1);
    } catch (error) {
      console.error("Error toggling break day:", error);
      loadDailyEntry();
    }
  }, [dateString, isBreakDay, loadDailyEntry]);

  return {
    dailyEntry,
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    loading,
    currentActivityId,
    setCurrentActivityId,
    streakDbVersion,
    loadDailyEntry,
    getOrCreateDailyEntry,
    incrementTask,
    resetNeverTaskCount,
    toggleTaskPaused,
    toggleBreakDay,
  };
}
