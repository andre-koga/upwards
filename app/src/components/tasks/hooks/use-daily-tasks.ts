import { useEffect, useState, useMemo, useCallback } from "react";
import { db } from "@/lib/db";
import { toDateString } from "@/lib/time-utils";
import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import {
  shouldShowActivity,
  formatTimerDisplay,
  getGroup,
  getGroupColor,
} from "@/lib/activity";
import { getOrComputeActivityStreaksForDate } from "@/lib/streak-utils";
import { useDailyEntry } from "./use-daily-entry";
import { useOneTimeTasks } from "./use-one-time-tasks";
import { useActivityTracking } from "./use-activity-tracking";

interface UseDailyTasksParams {
  activities: Activity[];
  groups: ActivityGroup[];
  currentDate: Date;
  /** When this changes, daily entry / periods / tasks are reloaded (e.g. after sync). */
  refreshTrigger?: number;
}

export function useDailyTasks({
  activities,
  groups,
  currentDate,
  refreshTrigger = 0,
}: UseDailyTasksParams) {
  const dateString = toDateString(currentDate);
  const isToday = (() => {
    const todayMidnight = new Date(toDateString(new Date()) + "T00:00:00");
    const entryMidnight = new Date(dateString + "T00:00:00");
    const diffDays = Math.floor(
      (todayMidnight.getTime() - entryMidnight.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    // Treat yesterday as fully editable, same as today.
    return diffDays >= 0 && diffDays <= 1;
  })();
  const [activityStreaks, setActivityStreaks] = useState<
    Record<string, number>
  >({});
  const [allActivityPeriods, setAllActivityPeriods] = useState<
    ActivityPeriod[]
  >([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const {
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    loading,
    streakDbVersion,
    currentActivityId,
    setCurrentActivityId,
    loadDailyEntry,
    getOrCreateDailyEntry,
    incrementTask,
    resetNeverTaskCount,
    toggleTaskPaused,
    toggleBreakDay,
  } = useDailyEntry(dateString);

  const incrementNeverSlip = useCallback(
    (activityId: string) => incrementTask(activityId, 1, { neverSlip: true }),
    [incrementTask]
  );

  const {
    oneTimeTasks,
    loadOneTimeTasks,
    createOneTimeTask,
    toggleOneTimeTask,
    deleteOneTimeTask,
    updateOneTimeTask,
  } = useOneTimeTasks(dateString);

  const {
    activityPeriods,
    loadActivityPeriods,
    calculateActivityTime,
    handleStartActivity,
    handleStopActivity,
  } = useActivityTracking(
    dateString,
    currentActivityId,
    setCurrentActivityId,
    getOrCreateDailyEntry
  );

  const loadAllActivityPeriods = useCallback(async () => {
    try {
      const periods = await db.activityPeriods
        .filter((period) => !period.deleted_at)
        .toArray();
      setAllActivityPeriods(periods);
    } catch (error) {
      console.error("Error loading all activity periods:", error);
    }
  }, []);

  useEffect(() => {
    loadDailyEntry();
    loadActivityPeriods();
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- loading IndexedDB periods into local state for all-time activity totals */
    loadAllActivityPeriods();
    loadOneTimeTasks();
  }, [
    currentDate,
    loadDailyEntry,
    loadActivityPeriods,
    loadAllActivityPeriods,
    loadOneTimeTasks,
  ]);

  // When sync completes, refresh daily data without showing loading (avoids flash/scroll reset).
  useEffect(() => {
    if (refreshTrigger === 0) return;
    loadDailyEntry({ silent: true });
    loadActivityPeriods();
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- refreshing IndexedDB periods into local state after sync */
    loadAllActivityPeriods();
    loadOneTimeTasks();
  }, [
    refreshTrigger,
    loadDailyEntry,
    loadActivityPeriods,
    loadAllActivityPeriods,
    loadOneTimeTasks,
  ]);

  useEffect(() => {
    let cancelled = false;

    const visibleActivities = activities.filter((activity) =>
      shouldShowActivity(activity, currentDate)
    );

    void getOrComputeActivityStreaksForDate(visibleActivities, currentDate, {
      // Recompute target-day streaks for the viewed date so historical days
      // reflect current task counts instead of stale cached streak rows.
      forceRecomputeTarget: true,
    })
      .then((streaks) => {
        if (!cancelled) {
          setActivityStreaks(streaks);
        }
      })
      .catch((err) => {
        console.error("Error computing activity streaks:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activities,
    currentDate,
    isToday,
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    streakDbVersion,
  ]);

  const dailyActivities = useMemo(
    () => activities.filter((a) => shouldShowActivity(a, currentDate)),
    [activities, currentDate]
  );
  const pausedTaskIdSet = useMemo(
    () => new Set(pausedTaskIds),
    [pausedTaskIds]
  );

  const getGroupForActivity = useCallback(
    (activity: Activity): ActivityGroup | undefined =>
      getGroup(groups, activity.group_id),
    [groups]
  );

  const { nonNeverCount, completedCount, completionRate } = useMemo(() => {
    if (isBreakDay) {
      return {
        nonNeverCount: 0,
        completedCount: 0,
        completionRate: 0,
      };
    }

    const nonNever = dailyActivities.filter(
      (a) => a.routine !== "never" && !pausedTaskIdSet.has(a.id)
    ).length;
    const completed = dailyActivities.filter(
      (a) =>
        a.routine !== "never" &&
        !pausedTaskIdSet.has(a.id) &&
        (taskCounts[a.id] || 0) >= (a.completion_target ?? 1)
    ).length;
    const rate = nonNever === 0 ? 0 : Math.round((completed / nonNever) * 100);
    return {
      nonNeverCount: nonNever,
      completedCount: completed,
      completionRate: rate,
    };
  }, [dailyActivities, isBreakDay, pausedTaskIdSet, taskCounts]);

  const totalTimeSpentMs = useMemo(
    () =>
      dailyActivities.reduce(
        (total, activity) => total + calculateActivityTime(activity.id),
        0
      ),
    [dailyActivities, calculateActivityTime]
  );

  // Derive the truly running activity from open periods so UI
  // doesn't depend solely on the persisted currentActivityId.
  const resolvedCurrentActivityId = useMemo(() => {
    const openPeriods = activityPeriods.filter((period) => !period.end_time);

    if (openPeriods.length === 0) return null;

    const latestOpen = [...openPeriods].sort(
      (left, right) =>
        new Date(right.start_time).getTime() -
        new Date(left.start_time).getTime()
    )[0];

    return latestOpen?.activity_id ?? null;
  }, [activityPeriods]);

  useEffect(() => {
    if (!resolvedCurrentActivityId) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [resolvedCurrentActivityId]);

  const activityTotalMsById = useMemo(() => {
    const totals = new Map<string, number>();

    allActivityPeriods.forEach((period) => {
      if (!period.end_time) return;
      const start = new Date(period.start_time).getTime();
      const end = new Date(period.end_time).getTime();
      const intervalMs = Math.max(0, end - start);
      totals.set(
        period.activity_id,
        (totals.get(period.activity_id) ?? 0) + intervalMs
      );
    });

    return totals;
  }, [allActivityPeriods]);

  const calculateActivityTotalTime = useCallback(
    (activityId: string): number => activityTotalMsById.get(activityId) ?? 0,
    [activityTotalMsById]
  );

  const startActivity = useCallback(
    async (activityId: string) => {
      await handleStartActivity(activityId);
      await loadAllActivityPeriods();
    },
    [handleStartActivity, loadAllActivityPeriods]
  );

  const stopActivity = useCallback(async () => {
    await handleStopActivity();
    await loadAllActivityPeriods();
  }, [handleStopActivity, loadAllActivityPeriods]);

  const timelineSessions = useMemo(() => {
    const activitySessions = activityPeriods
      .filter((period) => !!period.end_time)
      .map((period) => {
        const activity = activities.find((a) => a.id === period.activity_id);
        const startTime = new Date(period.start_time).getTime();
        const endTime = new Date(period.end_time!).getTime();
        return {
          id: period.id,
          activityId: period.activity_id,
          groupId: activity?.group_id || "",
          name:
            activity?.name ??
            getGroup(groups, activity?.group_id ?? "")?.name ??
            "Unknown activity",
          groupColor: activity
            ? getGroupColor(groups, activity.group_id)
            : DEFAULT_GROUP_COLOR,
          intervalMs: Math.max(0, endTime - startTime),
          startTime,
        };
      });

    return activitySessions.sort((a, b) => b.startTime - a.startTime);
  }, [activityPeriods, activities, groups]);

  const runningSession = useMemo(() => {
    if (!resolvedCurrentActivityId) return null;
    const openPeriod = activityPeriods.find(
      (p) => !p.end_time && p.activity_id === resolvedCurrentActivityId
    );
    if (!openPeriod) return null;
    const activity = activities.find((a) => a.id === resolvedCurrentActivityId);
    const groupId = activity?.group_id ?? null;
    if (!groupId) return null;
    return { sessionId: openPeriod.id, groupId };
  }, [resolvedCurrentActivityId, activityPeriods, activities]);

  const currentActivityElapsedMs = useMemo(() => {
    if (!resolvedCurrentActivityId) return 0;

    const activePeriod = activityPeriods
      .filter(
        (period) =>
          period.activity_id === resolvedCurrentActivityId && !period.end_time
      )
      .sort(
        (left, right) =>
          new Date(right.start_time).getTime() -
          new Date(left.start_time).getTime()
      )[0];

    if (!activePeriod) return 0;

    const startMs = new Date(activePeriod.start_time).getTime();
    return Math.max(0, nowMs - startMs);
  }, [resolvedCurrentActivityId, activityPeriods, nowMs]);

  return {
    isToday,
    loading,
    activityStreaks,
    dailyActivities,
    getGroup: getGroupForActivity,
    nonNeverCount,
    completedCount,
    completionRate,
    totalTimeSpentMs,
    timelineSessions,
    currentActivityId: resolvedCurrentActivityId,
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    oneTimeTasks,
    createOneTimeTask,
    toggleOneTimeTask,
    deleteOneTimeTask,
    updateOneTimeTask,
    incrementTask,
    incrementNeverSlip,
    resetNeverTaskCount,
    toggleTaskPaused,
    toggleBreakDay,
    handleStartActivity: startActivity,
    handleStopActivity: stopActivity,
    runningSession,
    currentActivityElapsedMs,
    loadActivityPeriods,
    calculateActivityTime,
    calculateActivityTotalTime,
    formatTimerDisplay,
  };
}
