import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toDateStr } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import {
  shouldShowActivity,
  formatTimerDisplay,
  getGroup,
  getGroupColor,
} from "@/lib/activity-utils";
import { getOrComputeActivityStreaksForDate } from "@/lib/streak-utils";
import { useDailyEntry } from "./use-daily-entry";
import { useOneTimeTasks } from "./use-one-time-tasks";
import { useActivityTracking } from "./use-activity-tracking";
import { useMemoTracking } from "./use-memo-tracking";

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
  const navigate = useNavigate();
  const dateString = toDateStr(currentDate);
  const isToday = dateString === toDateStr(new Date());
  const [activityStreaks, setActivityStreaks] = useState<
    Record<string, number>
  >({});

  const {
    taskCounts,
    loading,
    currentActivityId,
    setCurrentActivityId,
    currentMemoId,
    setCurrentMemoId,
    loadDailyEntry,
    getOrCreateDailyEntry,
    incrementTask,
  } = useDailyEntry(dateString);

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

  const {
    memoPeriods,
    loadMemoPeriods,
    calculateMemoTime,
    handleStartMemo,
    handleStopMemo,
  } = useMemoTracking(
    dateString,
    currentMemoId,
    setCurrentMemoId,
    getOrCreateDailyEntry
  );

  useEffect(() => {
    loadDailyEntry();
    loadActivityPeriods();
    loadMemoPeriods();
    loadOneTimeTasks();
  }, [
    currentDate,
    loadDailyEntry,
    loadActivityPeriods,
    loadMemoPeriods,
    loadOneTimeTasks,
  ]);

  // When sync completes, refresh daily data without showing loading (avoids flash/scroll reset).
  useEffect(() => {
    if (refreshTrigger === 0) return;
    loadDailyEntry({ silent: true });
    loadActivityPeriods();
    loadMemoPeriods();
    loadOneTimeTasks();
  }, [
    refreshTrigger,
    loadDailyEntry,
    loadActivityPeriods,
    loadMemoPeriods,
    loadOneTimeTasks,
  ]);

  useEffect(() => {
    let cancelled = false;

    const visibleActivities = activities.filter((activity) =>
      shouldShowActivity(activity, currentDate)
    );

    void getOrComputeActivityStreaksForDate(visibleActivities, currentDate, {
      forceRecomputeTarget: isToday,
    }).then((streaks) => {
      if (!cancelled) {
        setActivityStreaks(streaks);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activities, currentDate, isToday, taskCounts]);

  const dailyActivities = useMemo(
    () => activities.filter((a) => shouldShowActivity(a, currentDate)),
    [activities, currentDate]
  );

  const getGroupForActivity = useCallback(
    (activity: Activity): ActivityGroup | undefined =>
      getGroup(groups, activity.group_id),
    [groups]
  );

  const { nonNeverCount, completedCount, completionRate } = useMemo(() => {
    const nonNever = dailyActivities.filter(
      (a) => a.routine !== "never"
    ).length;
    const completed = dailyActivities.filter(
      (a) =>
        a.routine !== "never" &&
        (taskCounts[a.id] || 0) >= (a.completion_target ?? 1)
    ).length;
    const rate = nonNever === 0 ? 0 : Math.round((completed / nonNever) * 100);
    return {
      nonNeverCount: nonNever,
      completedCount: completed,
      completionRate: rate,
    };
  }, [dailyActivities, taskCounts]);

  const totalTimeSpentMs = useMemo(
    () =>
      dailyActivities.reduce(
        (total, activity) => total + calculateActivityTime(activity.id),
        0
      ),
    [dailyActivities, calculateActivityTime]
  );

  const MEMO_TIMELINE_COLOR = "#6b7280";

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

  const timelineSessions = useMemo(() => {
    const activitySessions = activityPeriods
      .filter((period) => !!period.end_time)
      .map((period) => {
        const activity = activities.find((a) => a.id === period.activity_id);
        const startTime = new Date(period.start_time).getTime();
        const endTime = new Date(period.end_time!).getTime();
        return {
          id: period.id,
          type: "activity" as const,
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

    const memoSessions = memoPeriods
      .filter((period) => !!period.end_time)
      .map((period) => {
        const memo = oneTimeTasks.find((t) => t.id === period.one_time_task_id);
        const startTime = new Date(period.start_time).getTime();
        const endTime = new Date(period.end_time!).getTime();
        return {
          id: period.id,
          type: "memo" as const,
          activityId: "",
          groupId: "",
          name: memo?.title ?? "Memo",
          groupColor: MEMO_TIMELINE_COLOR,
          intervalMs: Math.max(0, endTime - startTime),
          startTime,
        };
      });

    return [...activitySessions, ...memoSessions].sort(
      (a, b) => b.startTime - a.startTime
    );
  }, [activityPeriods, memoPeriods, activities, groups, oneTimeTasks]);

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

  const handleTimelineClick = useCallback(
    (groupId: string, sessionId: string) => {
      if (groupId) {
        navigate(`/activities/${groupId}/sessions/${sessionId}`);
      }
    },
    [navigate]
  );

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
    currentMemoId,
    taskCounts,
    oneTimeTasks,
    createOneTimeTask,
    toggleOneTimeTask,
    deleteOneTimeTask,
    updateOneTimeTask,
    incrementTask,
    handleStartActivity,
    handleStopActivity,
    handleStartMemo,
    handleStopMemo,
    handleTimelineClick,
    runningSession,
    loadActivityPeriods,
    calculateActivityTime,
    calculateMemoTime,
    formatTimerDisplay,
  };
}
