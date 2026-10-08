import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { requestOldDayEdit } from "@/lib/journal/old-day-gate";
import { db, newId, now } from "@/lib/db";
import { toDateString, todayDateString } from "@/lib/time-utils";
import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import {
  shouldShowActivity,
  formatTimerDisplay,
  getGroup,
  type TemporalVisibilityContext,
} from "@/lib/activity";
import { computeActivityStreaksForDate } from "@/lib/streak-utils";
import { saveTimedPeriod } from "@/lib/sync/mutate-synced";
import { normalizeSessionNote } from "@/lib/activity/session-note";
import { buildTimelineSessions } from "@/lib/activity/timeline-sessions";
import { useDailyEntry } from "./use-daily-entry";
import { useOneTimeTasks } from "./use-one-time-tasks";
import { useActivityTracking } from "./use-activity-tracking";

interface UseDailyTasksParams {
  /** All habits (incl. soft-deleted/archived) for historical For Today + timeline. */
  lookupActivities: Activity[];
  groups: ActivityGroup[];
  lookupActivityById: Map<string, Activity>;
  lookupGroupById: Map<string, ActivityGroup>;
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
  currentDate,
  refreshTrigger = 0,
  dayResetTick = 0,
}: UseDailyTasksParams) {
  const { t } = useTranslation("journal");
  const dateString = toDateString(currentDate);
  const isToday = dateString === todayDateString();
  const [activityStreaks, setActivityStreaks] = useState<
    Record<string, number>
  >({});
  const [allActivityPeriods, setAllActivityPeriods] = useState<
    ActivityPeriod[]
  >([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const streakVisibilityDeps = useMemo(
    () => ({ groupById: lookupGroupById }),
    [lookupGroupById]
  );

  const temporalForViewDate = useMemo<TemporalVisibilityContext>(
    () => ({ viewDate: currentDate }),
    [currentDate]
  );

  const {
    dailyEntry,
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    loading,
    loadDailyEntry,
    incrementTask,
    resetNeverTaskCount,
    toggleTaskPaused,
    toggleBreakDay,
  } = useDailyEntry(dateString);

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

  const {
    currentActivityId,
    activityPeriods,
    loadActivityPeriods,
    calculateActivityTime,
    getActivityElapsedMs: getActivityElapsedMsRaw,
    handleStartActivity,
    handleStopActivity,
  } = useActivityTracking(dateString);

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
    void loadOneTimeTasks();
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
    void loadOneTimeTasks();
  }, [
    refreshTrigger,
    loadDailyEntry,
    loadActivityPeriods,
    loadAllActivityPeriods,
    loadOneTimeTasks,
  ]);

  useEffect(() => {
    if (dayResetTick === 0) return;
    void loadOneTimeTasks();
  }, [dayResetTick, loadOneTimeTasks]);

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

    void computeActivityStreaksForDate(visibleActivities, currentDate, {
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

    const nonNever = dailyActivities.filter((a) => {
      return a.routine !== "never" && !pausedTaskIdSet.has(a.id);
    }).length;
    const completed = dailyActivities.filter((a) => {
      return (
        a.routine !== "never" &&
        !pausedTaskIdSet.has(a.id) &&
        (taskCounts[a.id] || 0) >= (a.completion_target ?? 1)
      );
    }).length;
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
      if (!isToday || currentActivityId !== activityId) {
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
      currentActivityId,
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
      note?: string | null;
    }) => {
      const { activityId, startIso, endIso, note } = params;
      const createdAt = now();
      const entryDateString = toDateString(new Date(startIso));
      const { confirmed } = await requestOldDayEdit(
        entryDateString,
        t("oldDay.activity.summary", { ns: "journal" })
      );
      if (!confirmed) return;
      const period: ActivityPeriod = {
        id: newId(),
        activity_id: activityId,
        start_time: startIso,
        end_time: endIso,
        note: normalizeSessionNote(note),
        created_at: createdAt,
        updated_at: createdAt,
        synced_at: null,
        deleted_at: null,
      };
      await saveTimedPeriod(period);

      await loadActivityPeriods();
      await loadAllActivityPeriods();
    },
    [loadActivityPeriods, loadAllActivityPeriods, t]
  );

  const timelineSessions = useMemo(
    () =>
      buildTimelineSessions({
        periods: activityPeriods,
        dateString,
        nowMs,
        lookupActivityById,
        lookupGroupById,
        taskCounts,
        completionNotes: dailyEntry?.completion_notes ?? {},
        completionTimes: dailyEntry?.completion_times ?? {},
      }),
    [
      activityPeriods,
      lookupActivityById,
      lookupGroupById,
      dateString,
      nowMs,
      taskCounts,
      dailyEntry?.completion_notes,
      dailyEntry?.completion_times,
    ]
  );

  const runningSession = useMemo(() => {
    if (!currentActivityId) return null;
    const openPeriod = activityPeriods.find(
      (p) => !p.end_time && p.activity_id === currentActivityId
    );
    if (!openPeriod) return null;
    const activity = lookupActivityById.get(currentActivityId);
    const groupId = activity?.group_id ?? null;
    if (!groupId) return null;
    return { sessionId: openPeriod.id, groupId };
  }, [currentActivityId, activityPeriods, lookupActivityById]);

  const currentActivityElapsedMs = useMemo(() => {
    if (!currentActivityId) return 0;

    const activePeriod = activityPeriods
      .filter(
        (period) => period.activity_id === currentActivityId && !period.end_time
      )
      .sort(
        (left, right) =>
          new Date(right.start_time).getTime() -
          new Date(left.start_time).getTime()
      )[0];

    if (!activePeriod) return 0;

    const startMs = new Date(activePeriod.start_time).getTime();
    // The running pill shows the session's full elapsed time, not its share
    // of this day.
    return Math.max(0, nowMs - startMs);
  }, [currentActivityId, activityPeriods, nowMs]);

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
    currentActivityId,
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
  };
}
