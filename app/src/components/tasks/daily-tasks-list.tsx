import { useEffect } from "react";
import { toDateStr } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { shouldShowActivity } from "@/lib/activity-utils";
import { useDailyEntry } from "./hooks/use-daily-entry";
import { useOneTimeTasks } from "./hooks/use-one-time-tasks";
import { useActivityTracking } from "./hooks/use-activity-tracking";
import ActivityTaskItem from "./activity-task-item";
import OneTimeTaskItem from "./one-time-task-item";
import AddTaskModal from "./add-task-modal";

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
    createOneTimeTask,
    toggleOneTimeTask,
    deleteOneTimeTask,
  } = useOneTimeTasks(dateString);

  const { loadActivityPeriods, calculateActivityTime, handleStartActivity } =
    useActivityTracking(
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

  return (
    <div className="flex flex-col">
      {dailyActivities.length > 0 && (
        <p className="text-xs text-muted-foreground text-right mb-2">
          {completedCount} / {nonNeverCount} ({completionRate}%)
        </p>
      )}

      <div className="space-y-2 mt-4 flex-1">
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

      {isToday && <AddTaskModal onAdd={createOneTimeTask} />}
    </div>
  );
}
