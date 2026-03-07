import { useEffect } from "react";
import { toDateStr } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { shouldShowActivity, formatTimerDisplay } from "@/lib/activity-utils";
import { useDailyEntry } from "./hooks/use-daily-entry";
import { useOneTimeTasks } from "./hooks/use-one-time-tasks";
import { useActivityTracking } from "./hooks/use-activity-tracking";
import ActivityTaskItem from "./activity-task-item";
import ActivityTimelineItem from "./activity-timeline-item";
import OneTimeTaskItem from "./one-time-task-item";
import ActivityGroupsDrawer from "./activity-groups-drawer";
import ActiveActivityPill from "./active-activity-pill";

interface DailyTasksListProps {
  activities: Activity[];
  groups: ActivityGroup[];
  currentDate: Date;
}

export default function DailyTasksList({
  activities,
  groups,
  currentDate,
}: DailyTasksListProps) {
  const dateString = toDateStr(currentDate);
  const isToday = dateString === toDateStr(new Date());

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
    getOrCreateDailyEntry,
  );

  // Reload all data whenever the viewed date changes
  useEffect(() => {
    loadDailyEntry();
    loadActivityPeriods();
    loadOneTimeTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const dailyActivities = activities.filter((a) =>
    shouldShowActivity(a, currentDate),
  );

  const getGroup = (activity: Activity): ActivityGroup | undefined =>
    groups.find((g) => g.id === activity.group_id);

  const nonNeverCount = dailyActivities.filter(
    (a) => a.routine !== "never",
  ).length;
  const completedCount = dailyActivities.filter(
    (a) =>
      a.routine !== "never" &&
      (taskCounts[a.id] || 0) >= (a.completion_target ?? 1),
  ).length;
  const completionRate =
    nonNeverCount === 0
      ? 0
      : Math.round((completedCount / nonNeverCount) * 100);

  const totalTimeSpentMs = dailyActivities.reduce(
    (total, activity) => total + calculateActivityTime(activity.id),
    0,
  );

  const timelineSessions = activityPeriods
    .slice()
    .filter((period) => !!period.end_time)
    .sort(
      (left, right) =>
        new Date(right.start_time).getTime() -
        new Date(left.start_time).getTime(),
    )
    .map((period) => {
      const activity = activities.find((a) => a.id === period.activity_id);
      const group = activity
        ? groups.find((groupItem) => groupItem.id === activity.group_id)
        : undefined;

      const startTime = new Date(period.start_time).getTime();
      const endTime = new Date(period.end_time!).getTime();

      return {
        id: period.id,
        name: activity?.name || "Unknown activity",
        groupColor: group?.color || "#888",
        intervalMs: Math.max(0, endTime - startTime),
      };
    });

  return (
    <div className="flex flex-col">
      {dailyActivities.length > 0 && (
        <div className="flex items-center justify-between ml-1 mr-1.5 text-xs text-muted-foreground mb-2">
          <span>
            {completedCount} / {nonNeverCount} ({completionRate}%)
          </span>
          <span>{formatTimerDisplay(totalTimeSpentMs)}</span>
        </div>
      )}

      <div className="space-y-2 flex-1">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Loading...
          </p>
        )}
        {!loading && dailyActivities.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No daily activities yet. Create some activities to track!
          </p>
        )}
        {!loading &&
          dailyActivities.map((activity) => (
            <ActivityTaskItem
              key={activity.id}
              activity={activity}
              group={getGroup(activity)}
              count={taskCounts[activity.id] || 0}
              timeSpent={calculateActivityTime(activity.id)}
              isCurrentActivity={currentActivityId === activity.id}
              isToday={isToday}
              onIncrement={incrementTask}
              onStartActivity={handleStartActivity}
            />
          ))}
      </div>

      {(currentActivityId || timelineSessions.length > 0) && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline
          </p>
          <ActiveActivityPill
            currentActivityId={currentActivityId}
            activities={activities}
            groups={groups}
            calculateActivityTime={calculateActivityTime}
            onStop={handleStopActivity}
          />
          {timelineSessions.map((session) => (
            <ActivityTimelineItem
              key={session.id}
              activityName={session.name}
              groupColor={session.groupColor}
              intervalMs={session.intervalMs}
            />
          ))}
        </div>
      )}

      {oneTimeTasks.length > 0 && (
        <div className="space-y-2 mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            One-time Tasks
          </p>
          {oneTimeTasks.map((task) => (
            <OneTimeTaskItem
              key={task.id}
              task={task}
              isToday={isToday}
              onToggle={toggleOneTimeTask}
              onDelete={deleteOneTimeTask}
            />
          ))}
        </div>
      )}

      <ActivityGroupsDrawer
        currentActivityId={currentActivityId}
        activities={activities}
        onStartActivity={handleStartActivity}
        onStopActivity={handleStopActivity}
      />
    </div>
  );
}
