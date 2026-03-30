import { useState } from "react";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import ActivityTaskItem from "./activity-task-item";
import ActivityTimelineItem from "./activity-timeline-item";
import OneTimeTaskItem from "./one-time-task-item";
import ActivityGroupsDrawer from "./activity-groups-drawer";
import ActiveActivityPill from "./active-activity-pill";
import AddTaskModal from "./add-task-modal";
import AssignActivityDialog from "./assign-activity-dialog";
import { useDailyTasks } from "./hooks/use-daily-tasks";
import { CircleCheckBig, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SessionDetailsDialog from "@/components/activities/session-details-dialog";

export type DailyTasksState = ReturnType<typeof useDailyTasks>;

interface DailyTasksListProps {
  activities: Activity[];
  groups: ActivityGroup[];
  daily: DailyTasksState;
}

export default function DailyTasksList({
  activities,
  groups,
  daily,
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
    timelineSessions,
    currentActivityId,
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
    handleStartActivity,
    handleStopActivity,
    runningSession,
    currentActivityElapsedMs,
    loadActivityPeriods,
    calculateActivityTime,
    calculateActivityTotalTime,
    formatTimerDisplay,
  } = daily;
  const pausedTaskIdSet = new Set(pausedTaskIds);

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
        triggerClassName="fixed bottom-16 right-2 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
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
            />
          ))}
        </div>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        For Today
      </p>

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
              isPaused={pausedTaskIdSet.has(activity.id)}
              isBreakDay={isBreakDay}
              isCurrentActivity={currentActivityId === activity.id}
              isToday={isToday}
              onIncrement={incrementTask}
              onNeverIncrement={() => incrementNeverSlip(activity.id)}
              onNeverReset={() => resetNeverTaskCount(activity.id)}
              onTogglePaused={toggleTaskPaused}
              onStartActivity={handleStartActivity}
              onStopActivity={handleStopActivity}
            />
          ))}
      </div>

      <div className="mt-4 flex flex-col items-center justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void toggleBreakDay();
          }}
          disabled={!isToday}
          className={cn(
            "inline-flex gap-1.5 rounded-full border-border bg-background px-4 py-1.5 text-xs font-medium disabled:cursor-default disabled:opacity-70",
            isBreakDay
              ? "text-amber-500"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={isBreakDay ? "Unset break day" : "Mark this day as break day"}
        >
          <Palmtree className="h-3.5 w-3.5" />
          {isBreakDay ? "Break Day Active" : "Mark as Break Day"}
        </Button>
        {!isBreakDay && (
          <p className="text-center text-[11px] text-muted-foreground">
            Incomplete tasks won&apos;t affect streaks.
          </p>
        )}
      </div>

      {(currentActivityId || timelineSessions.length > 0) && (
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
                )
              )}
            </span>
          </div>
          <ActiveActivityPill
            currentActivityId={currentActivityId}
            activities={activities}
            groups={groups}
            elapsedMs={currentActivityElapsedMs}
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
          {timelineSessions.map((session) => {
            const isUnknown = !session.groupId;
            return (
              <ActivityTimelineItem
                key={session.id}
                activityName={session.name}
                groupColor={session.groupColor}
                intervalMs={session.intervalMs}
                activityId={session.activityId || ""}
                onClick={
                  isUnknown
                    ? () => openAssignDialog(session.id, session.intervalMs)
                    : () =>
                        setEditingSession({
                          groupId: session.groupId,
                          sessionId: session.id,
                        })
                }
                onStartActivity={
                  isToday && !isUnknown ? handleStartActivity : undefined
                }
              />
            );
          })}
        </div>
      )}

      <ActivityGroupsDrawer
        currentActivityId={currentActivityId}
        activities={activities}
        calculateActivityTime={calculateActivityTotalTime}
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
