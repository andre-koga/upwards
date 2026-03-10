import type { Activity, ActivityGroup } from "@/lib/db/types";
import ActivityTaskItem from "./activity-task-item";
import ActivityTimelineItem from "./activity-timeline-item";
import OneTimeTaskItem from "./one-time-task-item";
import ActivityGroupsDrawer from "./activity-groups-drawer";
import ActiveActivityPill from "./active-activity-pill";
import AddTaskModal from "./add-task-modal";
import { useDailyTasks } from "./hooks/use-daily-tasks";
import { CircleCheckBig } from "lucide-react";

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
  const {
    isToday,
    loading,
    activityStreaks,
    dailyActivities,
    getGroup,
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
  } = useDailyTasks({ activities, groups, currentDate });

  return (
    <div className="flex flex-col">
      <AddTaskModal
        onAdd={createOneTimeTask}
        icon={CircleCheckBig}
        triggerTitle="Add quick task"
        triggerClassName="fixed bottom-[4.5rem] right-6 z-[60] h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors"
      />

      {oneTimeTasks.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Memos
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

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        For Today
      </p>

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
              streak={activityStreaks[activity.id] || 0}
              timeSpent={calculateActivityTime(activity.id)}
              isCurrentActivity={currentActivityId === activity.id}
              isToday={isToday}
              onIncrement={incrementTask}
              onStartActivity={handleStartActivity}
              onStopActivity={handleStopActivity}
            />
          ))}
      </div>

      {(currentActivityId || timelineSessions.length > 0) && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between ml-1 mr-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Timeline
            </p>
            <span className="text-xs text-muted-foreground">
              {formatTimerDisplay(
                timelineSessions.reduce(
                  (total, session) => total + session.intervalMs,
                  0,
                ) +
                  (currentActivityId
                    ? calculateActivityTime(currentActivityId)
                    : 0),
              )}
            </span>
          </div>
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
              activityId={session.activityId}
              onClick={
                session.groupId
                  ? () => handleTimelineClick(session.groupId, session.id)
                  : undefined
              }
              onStartActivity={isToday ? handleStartActivity : undefined}
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
