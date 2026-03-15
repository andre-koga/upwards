/**
 * SRP: Renders today's tasks, timeline, and task-related dialogs.
 */
import { useState } from "react";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import ActivityTaskItem from "./activity-task-item";
import ActivityTimelineItem from "./activity-timeline-item";
import OneTimeTaskItem from "./one-time-task-item";
import ActivityGroupsDrawer from "./activity-groups-drawer";
import ActiveActivityPill from "./active-activity-pill";
import ActiveMemoPill from "./active-memo-pill";
import AddTaskModal from "./add-task-modal";
import AssignActivityDialog from "./assign-activity-dialog";
import { useDailyTasks } from "./hooks/use-daily-tasks";
import { CircleCheckBig } from "lucide-react";
import SessionDetailsDialog from "@/components/activities/session-details-dialog";

interface DailyTasksListProps {
  activities: Activity[];
  groups: ActivityGroup[];
  currentDate: Date;
  /** When this changes, daily data is reloaded (e.g. after sync). */
  refreshTrigger?: number;
}

export default function DailyTasksList({
  activities,
  groups,
  currentDate,
  refreshTrigger = 0,
}: DailyTasksListProps) {
  const [assignPeriodId, setAssignPeriodId] = useState<string | null>(null);
  const [assignIntervalMs, setAssignIntervalMs] = useState(0);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<{
    groupId: string;
    sessionId: string;
  } | null>(null);

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
    runningSession,
    loadActivityPeriods,
    calculateActivityTime,
    calculateMemoTime,
    formatTimerDisplay,
  } = useDailyTasks({ activities, groups, currentDate, refreshTrigger });

  const openAssignDialog = (periodId: string, intervalMs: number) => {
    setAssignPeriodId(periodId);
    setAssignIntervalMs(intervalMs);
    setAssignDialogOpen(true);
  };

  const handleAssignSuccess = () => {
    void loadActivityPeriods();
  };

  return (
    <div className="flex flex-col">
      <AddTaskModal
        onAdd={createOneTimeTask}
        icon={CircleCheckBig}
        triggerTitle="Add quick task"
        triggerClassName="fixed bottom-16 right-4 z-[60] h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors"
      />

      {oneTimeTasks.length > 0 && (
        <div className="mb-4 space-y-2">
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
              onUpdate={updateOneTimeTask}
              timeSpent={calculateMemoTime(task.id)}
              isCurrentMemo={currentMemoId === task.id}
              onStartMemo={handleStartMemo}
              onStopMemo={handleStopMemo}
            />
          ))}
        </div>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        For Today
      </p>

      {dailyActivities.length > 0 && (
        <div className="mb-2 ml-1 mr-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {completedCount} / {nonNeverCount} ({completionRate}%)
          </span>
          <span>{formatTimerDisplay(totalTimeSpentMs)}</span>
        </div>
      )}

      <div className="flex-1 space-y-2">
        {loading && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Loading...
          </p>
        )}
        {!loading && dailyActivities.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
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

      {(currentActivityId || currentMemoId || timelineSessions.length > 0) && (
        <div className="mt-6 space-y-2">
          <div className="ml-1 mr-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Timeline
            </p>
            <span className="text-xs text-muted-foreground">
              {formatTimerDisplay(
                timelineSessions.reduce(
                  (total, session) => total + session.intervalMs,
                  0
                ) +
                  (currentActivityId
                    ? calculateActivityTime(currentActivityId)
                    : 0) +
                  (currentMemoId ? calculateMemoTime(currentMemoId) : 0)
              )}
            </span>
          </div>
          <ActiveActivityPill
            currentActivityId={currentActivityId}
            activities={activities}
            groups={groups}
            calculateActivityTime={calculateActivityTime}
            onStop={handleStopActivity}
            onEdit={
              runningSession
                ? () =>
                    setEditingSession({
                      groupId: runningSession.groupId,
                      sessionId: runningSession.sessionId,
                    })
                : undefined
            }
          />
          <ActiveMemoPill
            currentMemoId={currentMemoId}
            oneTimeTasks={oneTimeTasks}
            calculateMemoTime={calculateMemoTime}
            onStop={handleStopMemo}
          />
          {timelineSessions.map((session) => {
            const isMemo = session.type === "memo";
            const isUnknown = !isMemo && !session.groupId;
            return (
              <ActivityTimelineItem
                key={session.id}
                activityName={session.name}
                groupColor={session.groupColor}
                intervalMs={session.intervalMs}
                activityId={session.activityId || ""}
                onClick={
                  isMemo
                    ? undefined
                    : isUnknown
                      ? () => openAssignDialog(session.id, session.intervalMs)
                      : () =>
                          setEditingSession({
                            groupId: session.groupId,
                            sessionId: session.id,
                          })
                }
                onStartActivity={
                  isToday && !isMemo && !isUnknown
                    ? handleStartActivity
                    : undefined
                }
              />
            );
          })}
        </div>
      )}

      <ActivityGroupsDrawer
        currentActivityId={currentActivityId}
        activities={activities}
        calculateActivityTime={calculateActivityTime}
        onStartActivity={handleStartActivity}
        onStopActivity={handleStopActivity}
      />

      {assignPeriodId && (
        <AssignActivityDialog
          periodId={assignPeriodId}
          intervalMs={assignIntervalMs}
          open={assignDialogOpen}
          onOpenChange={(open) => {
            setAssignDialogOpen(open);
            if (!open) setAssignPeriodId(null);
          }}
          onSuccess={handleAssignSuccess}
        />
      )}

      {editingSession && (
        <SessionDetailsDialog
          groupId={editingSession.groupId}
          sessionId={editingSession.sessionId}
          open={editingSession !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditingSession(null);
            }
          }}
          onSessionUpdated={() => {
            void loadActivityPeriods();
          }}
        />
      )}
    </div>
  );
}
