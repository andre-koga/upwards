import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { db, newId, now } from "@/lib/db";
import { toDateString } from "@/lib/time-utils";
import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  ActivityStatusEvent,
  GroupStatusEvent,
} from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import {
  shouldShowActivity,
  formatTimerDisplay,
  getGroup,
  getGroupColor,
  getActivityDisplayName,
  type TemporalVisibilityContext,
} from "@/lib/activity";
import type { StreakVisibilityDeps } from "@/lib/streak-utils";
import { isJournalCalendarDateEditable } from "@/lib/journal";
import {
  getOrComputeActivityStreaksForDate,
  recomputeActivityStreaksFromDateForActivities,
} from "@/lib/streak-utils";
import { getOrCreateDailyEntry as getOrCreateDailyEntryDb } from "@/lib/db/daily-entry";
import { emitDailyComplete } from "@/lib/promises/emit-progress";
import { useDailyEntry } from "./use-daily-entry";
import { useOneTimeTasks } from "./use-one-time-tasks";
import { useActivityTracking } from "./use-activity-tracking";

interface UseDailyTasksParams {
  /** Active habits for starting new tracking today. */
  activities: Activity[];
  /** All habits (incl. soft-deleted/completed) for historical For Today + timeline. */
  lookupActivities: Activity[];
  groups: ActivityGroup[];
  lookupGroups: ActivityGroup[];
  lookupActivityById: Map<string, Activity>;
  lookupGroupById: Map<string, ActivityGroup>;
  activityEventsById: Map<string, ActivityStatusEvent[]>;
  groupEventsById: Map<string, GroupStatusEvent[]>;
  currentDate: Date;
  /** When this changes, daily entry / periods / tasks are reloaded (e.g. after sync). */
  refreshTrigger?: number;
}

export function useDailyTasks({
  activities,
  lookupActivities,
  groups,
  lookupGroups,
  lookupActivityById,
  lookupGroupById,
  activityEventsById,
  groupEventsById,
  currentDate,
  refreshTrigger = 0,
}: UseDailyTasksParams) {
  const dateString = toDateString(currentDate);
  // Same editable window as the journal card (`canEditJournal`); misleading name retained for callers.
  const isToday = isJournalCalendarDateEditable(currentDate);
  const [activityStreaks, setActivityStreaks] = useState<
    Record<string, number>
  >({});
  const [allActivityPeriods, setAllActivityPeriods] = useState<
    ActivityPeriod[]
  >([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [recalculateStreaksBusy, setRecalculateStreaksBusy] = useState(false);
  const [goalRefreshKey, setGoalRefreshKey] = useState(0);
  const recalcStreaksInFlightRef = useRef(false);

  const streakVisibilityDeps = useMemo<StreakVisibilityDeps>(
    () => ({
      groupById: lookupGroupById,
      activityEventsById,
      groupEventsById,
    }),
    [lookupGroupById, activityEventsById, groupEventsById]
  );

  const temporalForViewDate = useMemo<TemporalVisibilityContext>(
    () => ({
      viewDate: currentDate,
      activityEventsById,
      groupEventsById,
    }),
    [currentDate, activityEventsById, groupEventsById]
  );

  const {
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    loading,
    streakDbVersion,
    bumpStreakDbVersion,
    currentActivityId,
    setCurrentActivityId,
    loadDailyEntry,
    getOrCreateDailyEntry,
    incrementTask,
    resetNeverTaskCount,
    toggleTaskPaused,
    toggleBreakDay,
  } = useDailyEntry(dateString);

  // Wraps incrementTask to fire promise progress events after a successful completion.
  const incrementTaskWithProgress = useCallback(
    async (activityId: string, target: number, options?: { neverSlip?: boolean }) => {
      await incrementTask(activityId, target, options);
      if (options?.neverSlip) return; // slip counts are not completions

      const activity =
        lookupActivityById.get(activityId) ??
        activities.find((a) => a.id === activityId);
      if (!activity) return;

      // Read the newly persisted count from IndexedDB to avoid stale closure values.
      const entry = await db.dailyEntries
        .where("date")
        .equals(dateString)
        .filter((e) => !e.deleted_at)
        .first();
      const newCount = (entry?.task_counts as Record<string, number> | null)?.[activityId] ?? 0;
      const group =
        lookupGroupById.get(activity.group_id) ??
        groups.find((g) => g.id === activity.group_id);
      const completionTarget = activity.completion_target ?? 1;

      if (newCount === completionTarget) {
        await emitDailyComplete({
          activityId,
          activityName: getActivityDisplayName(activity, group),
          newCount,
          completionTarget,
          dateString,
        });
        setGoalRefreshKey((key) => key + 1);
      }
    },
    [
      incrementTask,
      lookupActivityById,
      activities,
      lookupGroupById,
      groups,
      dateString,
    ]
  );

  const incrementNeverSlip = useCallback(
    async (activityId: string) => {
      await incrementTaskWithProgress(activityId, 1, { neverSlip: true });
      setGoalRefreshKey((key) => key + 1);
    },
    [incrementTaskWithProgress]
  );

  const resetNeverTaskCountWithGoals = useCallback(
    async (activityId: string) => {
      await resetNeverTaskCount(activityId);
      setGoalRefreshKey((key) => key + 1);
    },
    [resetNeverTaskCount]
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

    const visibleActivities = lookupActivities.filter((activity) => {
      const group = lookupGroupById.get(activity.group_id);
      return shouldShowActivity(
        activity,
        currentDate,
        group,
        temporalForViewDate
      );
    });

    void getOrComputeActivityStreaksForDate(visibleActivities, currentDate, {
      // Recompute target-day streaks for the viewed date so historical days
      // reflect current task counts instead of stale cached streak rows.
      forceRecomputeTarget: true,
      visibility: streakVisibilityDeps,
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
    lookupActivities,
    lookupGroupById,
    temporalForViewDate,
    currentDate,
    isToday,
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    streakDbVersion,
    streakVisibilityDeps,
  ]);

  const dailyActivities = useMemo(
    () =>
      lookupActivities.filter((a) => {
        const group = lookupGroupById.get(a.group_id);
        return shouldShowActivity(a, currentDate, group, temporalForViewDate);
      }),
    [lookupActivities, lookupGroupById, currentDate, temporalForViewDate]
  );
  const pausedTaskIdSet = useMemo(
    () => new Set(pausedTaskIds),
    [pausedTaskIds]
  );

  const getGroupForActivity = useCallback(
    (activity: Activity): ActivityGroup | undefined =>
      lookupGroupById.get(activity.group_id) ??
      getGroup(groups, activity.group_id),
    [lookupGroupById, groups]
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

  const addManualActivityPeriod = useCallback(
    async (params: {
      activityId: string;
      dateString: string;
      startIso: string;
      endIso: string;
    }) => {
      const { activityId, dateString: periodDateString, startIso, endIso } =
        params;

      const createdAt = now();
      const dailyEntry = await getOrCreateDailyEntryDb(periodDateString);

      const period: ActivityPeriod = {
        id: newId(),
        daily_entry_id: dailyEntry.id,
        activity_id: activityId,
        start_time: startIso,
        end_time: endIso,
        created_at: createdAt,
        updated_at: createdAt,
        synced_at: null,
        deleted_at: null,
      };

      await db.activityPeriods.add(period);
      await loadActivityPeriods();
      await loadAllActivityPeriods();
    },
    [loadActivityPeriods, loadAllActivityPeriods]
  );

  const timelineSessions = useMemo(() => {
    const activitySessions = activityPeriods
      .filter((period) => !!period.end_time)
      .map((period) => {
        const activity = lookupActivityById.get(period.activity_id);
        const group = activity
          ? lookupGroupById.get(activity.group_id)
          : undefined;
        const startTime = new Date(period.start_time).getTime();
        const endTime = new Date(period.end_time!).getTime();
        return {
          id: period.id,
          activityId: period.activity_id,
          groupId: activity?.group_id || "",
          name: activity
            ? getActivityDisplayName(activity, group)
            : "Unknown activity",
          groupColor: activity
            ? (group?.color ?? DEFAULT_GROUP_COLOR)
            : DEFAULT_GROUP_COLOR,
          intervalMs: Math.max(0, endTime - startTime),
          startTime,
        };
      });

    return activitySessions.sort((a, b) => b.startTime - a.startTime);
  }, [activityPeriods, lookupActivityById, lookupGroupById]);

  const runningSession = useMemo(() => {
    if (!resolvedCurrentActivityId) return null;
    const openPeriod = activityPeriods.find(
      (p) => !p.end_time && p.activity_id === resolvedCurrentActivityId
    );
    if (!openPeriod) return null;
    const activity = lookupActivityById.get(resolvedCurrentActivityId);
    const groupId = activity?.group_id ?? null;
    if (!groupId) return null;
    return { sessionId: openPeriod.id, groupId };
  }, [resolvedCurrentActivityId, activityPeriods, lookupActivityById]);

  const recalculateStreaksFromViewedDate = useCallback(async () => {
    if (recalcStreaksInFlightRef.current) return;
    recalcStreaksInFlightRef.current = true;
    setRecalculateStreaksBusy(true);
    try {
      await recomputeActivityStreaksFromDateForActivities(
        lookupActivities,
        currentDate,
        { visibility: streakVisibilityDeps }
      );
      bumpStreakDbVersion();
    } catch (err) {
      console.error("Error recalculating activity streaks:", err);
    } finally {
      recalcStreaksInFlightRef.current = false;
      setRecalculateStreaksBusy(false);
    }
  }, [lookupActivities, currentDate, bumpStreakDbVersion, streakVisibilityDeps]);

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
    temporalForViewDate,
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
    incrementTask: incrementTaskWithProgress,
    incrementNeverSlip,
    resetNeverTaskCount: resetNeverTaskCountWithGoals,
    toggleTaskPaused,
    toggleBreakDay,
    handleStartActivity: startActivity,
    handleStopActivity: stopActivity,
    runningSession,
    currentActivityElapsedMs,
    loadActivityPeriods,
    calculateActivityTime,
    calculateActivityTotalTime,
    addManualActivityPeriod,
    formatTimerDisplay,
    recalculateStreaksFromViewedDate,
    recalculateStreaksBusy,
    goalRefreshKey,
  };
}
