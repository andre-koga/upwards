import { useState, useMemo } from "react";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import ActivityTaskItem from "./activity-task-item";
import ActivityTimelineItem from "./activity-timeline-item";
import OneTimeTaskItem from "./one-time-task-item";
import ActiveActivityPill from "./active-activity-pill";
import AssignActivityDialog from "./assign-activity-dialog";
import FooterActionsBar from "./footer-actions-bar";
import { useDailyTasks } from "./hooks/use-daily-tasks";
import ManualTimeEntryDialog from "./manual-time-entry-dialog";
import { ArchivedMemosDialog } from "./archived-memos-dialog";
import { Palmtree, RefreshCw, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SessionDetailsDialog from "@/components/activities/session-details-dialog";
import {
  getDayResetMinutes,
  formatResetMinutes,
} from "@/lib/session/day-reset";

export type DailyTasksState = ReturnType<typeof useDailyTasks>;

interface DailyTasksListProps {
  /** Active habits — used for starting new tracking from the footer. */
  activities: Activity[];
  /** All habits — used for timeline / running pill labels on historical days. */
  lookupActivities: Activity[];
  groups: ActivityGroup[];
  lookupGroups: ActivityGroup[];
  daily: DailyTasksState;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  entryDates: Set<string>;
  bookmarkedDates: Set<string>;
  loadJournalMeta: () => Promise<void>;
  onTasksDataChanged?: () => void;
}

export default function DailyTasksList({
  activities,
  lookupActivities,
  groups,
  lookupGroups,
  daily,
  currentDate,
  onDateChange,
  entryDates,
  bookmarkedDates,
  loadJournalMeta,
  onTasksDataChanged,
}: DailyTasksListProps) {
  const [assignPeriodId, setAssignPeriodId] = useState<string | null>(null);
  const [assignIntervalMs, setAssignIntervalMs] = useState(0);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<{
    groupId: string;
    sessionId: string;
  } | null>(null);
  const [manualEntryActivityId, setManualEntryActivityId] = useState<
    string | null
  >(null);
  const [archivedMemosDialogOpen, setArchivedMemosDialogOpen] = useState(false);

  const {
    isToday,
    isEditableDate,
    temporalForViewDate,
    loading,
    activityStreaks,
    baseStreaks,
    dailyActivities,
    getGroup,
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
    loadArchivedMemos,
    incrementTask,
    incrementNeverSlip,
    resetNeverTaskCount,
    toggleBreakDay,
    handleStartActivity,
    handleStopActivity,
    runningSession,
    currentActivityElapsedMs,
    loadActivityPeriods,
    getActivityElapsedMs,
    getActivityDrawerElapsedMs,
    addManualActivityPeriod,
    formatTimerDisplay,
    recalculateStreaksFromViewedDate,
    recalculateStreaksBusy,
  } = daily;
  const pausedTaskIdSet = new Set(pausedTaskIds);
  const manualEntryActivity = manualEntryActivityId
    ? (activities.find((item) => item.id === manualEntryActivityId) ?? null)
    : null;
  const manualEntryGroup = manualEntryActivity
    ? getGroup(manualEntryActivity)
    : undefined;

  const openAssignDialog = (periodId: string, intervalMs: number) => {
    setAssignPeriodId(periodId);
    setAssignIntervalMs(intervalMs);
    setAssignDialogOpen(true);
  };

  const resetMin = getDayResetMinutes();

  // Labels shown at the top and bottom of the timeline when a non-midnight
  // reset is configured, so the user knows when their "day" window starts/ends.
  const timelineBoundaryLabels = useMemo(() => {
    if (resetMin === 0) return null;
    const resetLabel = formatResetMinutes(resetMin);

    // Effective day starts at resetMin on the current calendar date.
    const [y, m, d] = currentDate.toISOString().split("T")[0].split("-").map(Number);
    const dayStart = new Date(y, (m || 1) - 1, d || 1);
    dayStart.setHours(Math.floor(resetMin / 60), resetMin % 60, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const fmt = (date: Date) =>
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return {
      top: `${resetLabel} ${fmt(dayEnd)}`,
      bottom: `${resetLabel} ${fmt(dayStart)}`,
    };
  }, [resetMin, currentDate]);

  const handleAssignSuccess = () => {
    void loadActivityPeriods();
  };

  return (
    <div className="flex flex-col">
      {oneTimeTasks.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Memos
            </p>
            {archivedMemos.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="smIcon"
                onClick={() => {
                  void loadArchivedMemos();
                  setArchivedMemosDialogOpen(true);
                }}
                className="h-4 min-h-4 w-4 min-w-4 shrink-0 bg-transparent p-0 text-muted-foreground/50 shadow-none hover:bg-transparent hover:text-muted-foreground/45 focus-visible:ring-1 [&_svg]:size-3"
                aria-label="View archived memos"
                title="View archived memos"
              >
                <Archive />
              </Button>
            )}
          </div>
          {oneTimeTasks.map((task) => (
            <OneTimeTaskItem
              key={task.id}
              task={task}
              isToday={isToday}
              onToggle={toggleOneTimeTask}
              onDelete={deleteOneTimeTask}
              onUpdate={updateOneTimeTask}
              onArchive={() => {
                void loadArchivedMemos();
              }}
            />
          ))}
        </div>
      )}

      {(loading || dailyActivities.length > 0) && (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              For Today
            </p>
            <Button
              type="button"
              variant="ghost"
              size="smIcon"
              onClick={() => {
                void recalculateStreaksFromViewedDate();
              }}
              disabled={recalculateStreaksBusy}
              className="h-4 min-h-4 w-4 min-w-4 shrink-0 bg-transparent p-0 text-muted-foreground/50 shadow-none hover:bg-transparent hover:text-muted-foreground/45 focus-visible:ring-1 disabled:opacity-30 [&_svg]:size-3"
              aria-label="Recompute streak counters from this day through today using your task history"
              title="Recompute streak counters from this day through today using your task history. Use this if streak numbers look wrong."
            >
              <RefreshCw className={cn(recalculateStreaksBusy && "animate-spin")} />
            </Button>
          </div>

          <div className="flex-1 space-y-2">
            {loading && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Loading...
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
                  timeSpent={getActivityElapsedMs(activity.id)}
                  isPaused={pausedTaskIdSet.has(activity.id)}
                  isBreakDay={isBreakDay}
                  isCurrentActivity={currentActivityId === activity.id}
                  isEditableDate={isEditableDate}
                  temporal={temporalForViewDate}
                  onIncrement={incrementTask}
                  onNeverIncrement={() => incrementNeverSlip(activity.id)}
                  onNeverReset={() => resetNeverTaskCount(activity.id)}
                  onStartActivity={handleStartActivity}
                  onStopActivity={handleStopActivity}
                  onManualEntry={setManualEntryActivityId}
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
              disabled={!isEditableDate}
              className={cn(
                "inline-flex gap-1.5 rounded-full border-border bg-background px-4 py-1.5 text-xs font-medium disabled:cursor-default",
                isBreakDay ? "text-amber-500" : "text-muted-foreground"
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
        </>
      )}

      {(currentActivityId || timelineSessions.length > 0) && (
        <div className="mt-6 space-y-2">
          <div className="ml-1 mr-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Timeline
              {timelineBoundaryLabels && (
                <span className="ml-1.5 font-normal normal-case">
                  (starts and ends at {formatResetMinutes(resetMin)})
                </span>
              )}
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
            activities={lookupActivities}
            groups={lookupGroups}
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

      <FooterActionsBar
        currentDate={currentDate}
        onDateChange={onDateChange}
        entryDates={entryDates}
        bookmarkedDates={bookmarkedDates}
        loadJournalMeta={loadJournalMeta}
        currentActivityId={currentActivityId}
        activities={activities}
        getActivityDrawerElapsedMs={getActivityDrawerElapsedMs}
        onStartActivity={handleStartActivity}
        onStopActivity={handleStopActivity}
        onAddManualActivityPeriod={addManualActivityPeriod}
        onAddQuickMemo={createOneTimeTask}
        onTasksDataChanged={onTasksDataChanged}
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

      <ManualTimeEntryDialog
        open={manualEntryActivityId !== null}
        activity={manualEntryActivity}
        group={manualEntryGroup}
        initialDate={currentDate}
        onOpenChange={(open) => {
          if (!open) {
            setManualEntryActivityId(null);
          }
        }}
        onSave={addManualActivityPeriod}
      />

      <ArchivedMemosDialog
        open={archivedMemosDialogOpen}
        onOpenChange={setArchivedMemosDialogOpen}
        archivedMemos={archivedMemos}
        onMemoRestored={() => {
          void loadArchivedMemos();
        }}
      />
    </div>
  );
}
