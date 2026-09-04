import { useState, useCallback, useRef } from "react";
import { db } from "@/lib/db";
import { getOrCreateDailyEntry as getOrCreateDailyEntryDb } from "@/lib/db/daily-entry";
import type { DailyEntry } from "@/lib/db/types";
import {
  applyBreakDayChange,
  applyCountDelta,
  applyPauseChange,
} from "@/lib/sync/mutate-synced";

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

  // Refs let us compute the exact next persisted values without relying on
  // React state updater callbacks having run before awaiting persistence.
  // They are written inside async/event callbacks only — never during render.
  const taskCountsRef = useRef(taskCounts);
  const pausedTaskIdsRef = useRef(pausedTaskIds);

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

      const saved = await applyCountDelta({
        date: dateString,
        activityId,
        previousCount: current,
        nextCount: nextCounts[activityId] || 0,
        reason: neverSlip
          ? "never_slip"
          : nextCount === 0
            ? "cycle"
            : "increment",
        completionAt: neverSlip
          ? undefined
          : nextCount >= target
            ? new Date().toISOString()
            : nextCount < target
              ? null
              : undefined,
      });
      if (prevPausedTaskIds.includes(activityId)) {
        await applyPauseChange({
          date: dateString,
          activityId,
          paused: false,
        });
      }
      setDailyEntry(saved);
      return { previousCount: current, nextCount: nextCounts[activityId] || 0 };
    },
    [dateString]
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

      const saved = await applyCountDelta({
        date: dateString,
        activityId,
        previousCount,
        nextCount: 0,
        reason: "reset",
        completionAt: null,
      });
      setDailyEntry(saved);
    },
    [dateString]
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
        const saved = await applyPauseChange({
          date: dateString,
          activityId,
          paused: !wasPaused,
        });
        setDailyEntry(saved);
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
      const saved = await applyBreakDayChange({
        date: dateString,
        isBreakDay: nextIsBreakDay,
      });
      setDailyEntry(saved);
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
    loadDailyEntry,
    getOrCreateDailyEntry,
    incrementTask,
    resetNeverTaskCount,
    toggleTaskPaused,
    toggleBreakDay,
  };
}
