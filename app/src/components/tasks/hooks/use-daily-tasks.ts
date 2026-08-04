import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { db, newId, now } from "@/lib/db";
import { toDateString } from "@/lib/time-utils";
import type {
  Activity,
  ActivityDefinitionVersion,
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
  getActivityDisplayName,
  type TemporalVisibilityContext,
} from "@/lib/activity";
import {
  resolveActivityDefinitionsForDate,
  toSchedulableActivity,
} from "@/lib/activity/temporal-resolver";
import { getEffectiveToday } from "@/lib/session/day-reset";
import {
  getOrComputeActivityStreaksForDate,
  recomputeActivityStreaksFromDateForActivities,
} from "@/lib/streak-utils";
import {
  clipPeriodToDay,
  effectiveDateForMs,
  effectiveDayStartMs,
} from "@/lib/activity/period-day-utils";
import { isActivityDateEditable } from "@/lib/journal/editable-window";
import { getOrCreateDailyEntry as getOrCreateDailyEntryDb } from "@/lib/db/daily-entry";
import { useDailyEntry } from "./use-daily-entry";
import { useOneTimeTasks } from "./use-one-time-tasks";
import { useActivityTracking } from "./use-activity-tracking";
import { spawnRecurringMemosForToday } from "@/lib/memos/spawn-recurring-memos";

interface UseDailyTasksParams {
  /** All habits (incl. soft-deleted/completed) for historical For Today + timeline. */
  lookupActivities: Activity[];
  groups: ActivityGroup[];
  lookupActivityById: Map<string, Activity>;
  lookupGroupById: Map<string, ActivityGroup>;
  activityEventsById: Map<string, ActivityStatusEvent[]>;
  groupEventsById: Map<string, GroupStatusEvent[]>;
  currentDate: Date;
  /** When this changes, daily entry / periods / tasks are reloaded (e.g. after sync). */
  refreshTrigger?: number;
  /** Incremented when the logical day resets while the app is open. */
  dayResetTick?: number;
}

export function useDailyTasks({
  lookupActivities,
  groups,
  lookupActivityById,
  lookupGroupById,
  activityEventsById,
  groupEventsById,
  currentDate,
  refreshTrigger = 0,
  dayResetTick = 0,
}: UseDailyTasksParams) {
  const dateString = toDateString(currentDate);
  // Tasks and timers are only editable on the current effective day.
  // Journal entries keep their own 7-day window (isJournalCalendarDateEditable).
  const isToday = dateString === getEffectiveToday();
  const isEditableDate = isActivityDateEditable(dateString);
  const [activityStreaks, setActivityStreaks] = useState<
    Record<string, number>
  >({});
  const [allActivityPeriods, setAllActivityPeriods] = useState<
    ActivityPeriod[]
  >([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [recalculateStreaksBusy, setRecalculateStreaksBusy] = useState(false);
  const [recalcTrigger, setRecalcTrigger] = useState(0);
  const recalcStreaksInFlightRef = useRef(false);
  const [activityDefinitionsById, setActivityDefinitionsById] = useState<
    Map<string, ActivityDefinitionVersion | Activity>
  >(new Map());

  useEffect(() => {
    let cancelled = false;
    void resolveActivityDefinitionsForDate(lookupActivities, dateString).then(
      (map) => {
        if (!cancelled) setActivityDefinitionsById(map);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [lookupActivities, dateString, refreshTrigger]);

  const streakVisibilityDeps = useMemo(
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
      activityDefinitionsById,
    }),
    [currentDate, activityEventsById, groupEventsById, activityDefinitionsById]
  );

  const {
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
  } = useDailyEntry(dateString);

  const incrementTaskWithProgress = useCallback(
    async (
      activityId: string,
      target: number,
      options?: { neverSlip?: boolean }
    ) => {
      await incrementTask(activityId, target, options);
    },
    [incrementTask]
  );

  const incrementNeverSlip = useCallback(
    async (activityId: string) => {
      await incrementTaskWithProgress(activityId, 1, { neverSlip: true });
    },
    [incrementTaskWithProgress]
  );

  const {
    oneTimeTasks,
    archivedMemos,
    loadOneTimeTasks,
    loadArchivedMemos,
    createOneTimeTask,
    toggleOneTimeTask,
    deleteOneTimeTask,
    updateOneTimeTask,
  } = useOneTimeTasks(dateString);

  const loadMemosWithSpawn = useCallback(async () => {
    if (dateString === getEffectiveToday()) {
      await spawnRecurringMemosForToday();
    }
    await loadOneTimeTasks();
  }, [dateString, loadOneTimeTasks]);

  const {
    activityPeriods,
    loadActivityPeriods,
    calculateActivityTime,
    getActivityElapsedMs: getActivityElapsedMsRaw,
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
    void loadMemosWithSpawn();
  }, [
    currentDate,
    loadDailyEntry,
    loadActivityPeriods,
    loadAllActivityPeriods,
    loadMemosWithSpawn,
  ]);

  // When sync completes, refresh daily data without showing loading (avoids flash/scroll reset).
  useEffect(() => {
    if (refreshTrigger === 0) return;
    loadDailyEntry({ silent: true });
    loadActivityPeriods();
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- refreshing IndexedDB periods into local state after sync */
    loadAllActivityPeriods();
    void loadMemosWithSpawn();
  }, [
    refreshTrigger,
    loadDailyEntry,
    loadActivityPeriods,
    loadAllActivityPeriods,
    loadMemosWithSpawn,
  ]);

  useEffect(() => {
    if (dayResetTick === 0) return;
    void loadMemosWithSpawn();
  }, [dayResetTick, loadMemosWithSpawn]);

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
      visibility: streakVisibilityDeps,
      todayOverride: {
        date: dateString,
        taskCounts,
        pausedTaskIds,
        isBreakDay,
      },
    })
      .then((streaks) => {
        if (!cancelled) setActivityStreaks(streaks);
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
    dateString,
    isToday,
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    recalcTrigger,
    streakVisibilityDeps,
    streakDbVersion,
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

    const schedulableFor = (activity: Activity) => {
      const resolved = activityDefinitionsById.get(activity.id);
      return resolved ? toSchedulableActivity(resolved) : activity;
    };

    const nonNever = dailyActivities.filter((a) => {
      const schedulable = schedulableFor(a);
      return schedulable.routine !== "never" && !pausedTaskIdSet.has(a.id);
    }).length;
    const completed = dailyActivities.filter((a) => {
      const schedulable = schedulableFor(a);
      return (
        schedulable.routine !== "never" &&
        !pausedTaskIdSet.has(a.id) &&
        (taskCounts[a.id] || 0) >= (schedulable.completion_target ?? 1)
      );
    }).length;
    const rate = nonNever === 0 ? 0 : Math.round((completed / nonNever) * 100);
    return {
      nonNeverCount: nonNever,
      completedCount: completed,
      completionRate: rate,
    };
  }, [
    dailyActivities,
    isBreakDay,
    pausedTaskIdSet,
    taskCounts,
    activityDefinitionsById,
  ]);

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

  const hasOpenPeriod = useMemo(
    () => activityPeriods.some((period) => !period.end_time),
    [activityPeriods]
  );

  const getActivityElapsedMs = useCallback(
    (activityId: string) =>
      getActivityElapsedMsRaw(activityId, {
        includeOpenPeriod: isToday,
        nowMs,
      }),
    [getActivityElapsedMsRaw, isToday, nowMs]
  );

  useEffect(() => {
    if (!isToday || !hasOpenPeriod) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isToday, hasOpenPeriod]);

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

  /** All-time tracked time for drawer pills (closed periods + live open session when running today). */
  const getActivityDrawerElapsedMs = useCallback(
    (activityId: string): number => {
      const totalMs = calculateActivityTotalTime(activityId);
      if (!isToday || resolvedCurrentActivityId !== activityId) {
        return totalMs;
      }

      const openPeriod = allActivityPeriods.find(
        (period) => period.activity_id === activityId && !period.end_time
      );
      if (!openPeriod) return totalMs;

      const startMs = new Date(openPeriod.start_time).getTime();
      return totalMs + Math.max(0, nowMs - startMs);
    },
    [
      calculateActivityTotalTime,
      isToday,
      resolvedCurrentActivityId,
      allActivityPeriods,
      nowMs,
    ]
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
      const { activityId, startIso, endIso } = params;
      const createdAt = now();
      const entryDateString = effectiveDateForMs(new Date(startIso).getTime());
      const dailyEntry = await getOrCreateDailyEntryDb(entryDateString);

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
    const dayStartMs = effectiveDayStartMs(dateString);
    const activitySessions = activityPeriods
      .filter((period) => !!period.end_time)
      .map((period) => {
        const activity = lookupActivityById.get(period.activity_id);
        const group = activity
          ? lookupGroupById.get(activity.group_id)
          : undefined;
        const startMs = new Date(period.start_time).getTime();
        const endMs = new Date(period.end_time!).getTime();
        // Clip the displayed duration to this effective day.
        const clippedInterval = clipPeriodToDay(
          startMs,
          endMs,
          dateString,
          nowMs
        );
        // Sort by where the session starts within this day (not the raw start_time,
        // which may be yesterday for cross-boundary periods).
        const clippedStartMs = Math.max(startMs, dayStartMs);
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
          intervalMs: Math.max(0, clippedInterval),
          startTime: clippedStartMs,
        };
      })
      .filter((s) => s.intervalMs > 0);

    return activitySessions.sort((a, b) => b.startTime - a.startTime);
  }, [activityPeriods, lookupActivityById, lookupGroupById, dateString, nowMs]);

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
      setRecalcTrigger((t) => t + 1);
    } catch (err) {
      console.error("Error recalculating activity streaks:", err);
    } finally {
      recalcStreaksInFlightRef.current = false;
      setRecalculateStreaksBusy(false);
    }
  }, [lookupActivities, currentDate, streakVisibilityDeps]);

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
    return clipPeriodToDay(startMs, null, dateString, nowMs);
  }, [resolvedCurrentActivityId, activityPeriods, nowMs, dateString]);

  return {
    isToday,
    isEditableDate,
    temporalForViewDate,
    activityDefinitionsById,
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
    archivedMemos,
    createOneTimeTask,
    toggleOneTimeTask,
    deleteOneTimeTask,
    updateOneTimeTask,
    loadOneTimeTasks,
    loadArchivedMemos,
    incrementTask: incrementTaskWithProgress,
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
    getActivityElapsedMs,
    getActivityDrawerElapsedMs,
    calculateActivityTotalTime,
    addManualActivityPeriod,
    formatTimerDisplay,
    recalculateStreaksFromViewedDate,
    recalculateStreaksBusy,
  };
}
