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

interface UseDailyTasksParams {
  activities: Activity[];
  groups: ActivityGroup[];
  currentDate: Date;
}

export function useDailyTasks({
  activities,
  groups,
  currentDate,
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

  useEffect(() => {
    loadDailyEntry();
    loadActivityPeriods();
    loadOneTimeTasks();
  }, [currentDate, loadDailyEntry, loadActivityPeriods, loadOneTimeTasks]);

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

  const timelineSessions = useMemo(
    () =>
      activityPeriods
        .slice()
        .filter((period) => !!period.end_time)
        .sort(
          (left, right) =>
            new Date(right.start_time).getTime() -
            new Date(left.start_time).getTime()
        )
        .map((period) => {
          const activity = activities.find((a) => a.id === period.activity_id);

          const startTime = new Date(period.start_time).getTime();
          const endTime = new Date(period.end_time!).getTime();

          return {
            id: period.id,
            activityId: period.activity_id,
            groupId: activity?.group_id || "",
            name: activity?.name || "Unknown activity",
            groupColor: activity
              ? getGroupColor(groups, activity.group_id)
              : DEFAULT_GROUP_COLOR,
            intervalMs: Math.max(0, endTime - startTime),
          };
        }),
    [activityPeriods, activities, groups]
  );

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
    currentActivityId,
    taskCounts,
    oneTimeTasks,
    createOneTimeTask,
    toggleOneTimeTask,
    deleteOneTimeTask,
    incrementTask,
    handleStartActivity,
    handleStopActivity,
    handleTimelineClick,
    calculateActivityTime,
    formatTimerDisplay,
  };
}
