import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { RecurringMemosDialog } from "./recurring-memos-dialog";
import { Palmtree, RefreshCw, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SessionDetailsDialog from "@/components/activities/session-details-dialog";
import { ActivityStatsDialog } from "@/components/activities/activity-stats-dialog";
import {
  ActivityRetiredInfoDialog,
  type ActivityRetiredKind,
} from "@/components/activities/activity-retired-info-dialog";
import {
  getDayResetMinutes,
  formatResetMinutes,
  getEffectiveToday,
} from "@/lib/session/day-reset";
import { getActiveLocaleTag } from "@/lib/i18n";

export type DailyTasksState = ReturnType<typeof useDailyTasks>;

interface DailyTasksListProps {
  /** Active habits — used for starting new tracking from the footer. */
  activities: Activity[];
  /** All habits — used for timeline / running pill labels on historical days. */
  lookupActivities: Activity[];
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
  lookupGroups,
  daily,
  currentDate,
  onDateChange,
  entryDates,
  bookmarkedDates,
  loadJournalMeta,
  onTasksDataChanged,
}: DailyTasksListProps) {
  const { t } = useTranslation("today");
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
  const [recurringMemosDialogOpen, setRecurringMemosDialogOpen] =
    useState(false);
  const [activityToStartOnToday, setActivityToStartOnToday] = useState<
    string | null
  >(null);
  const [statsActivity, setStatsActivity] = useState<Activity | null>(null);
  const [retiredInfo, setRetiredInfo] = useState<{
    kind: ActivityRetiredKind;
    activityName: string;
  } | null>(null);

  const {
    isToday,
    isEditableDate,
    temporalForViewDate,
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
    archivedMemos,
    createOneTimeTask,
    toggleOneTimeTask,
    deleteOneTimeTask,
    updateOneTimeTask,
    loadOneTimeTasks,
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
  } = daily;

  // When we navigate back to today with a pending activity, consume the
  // intent: start tracking and clear it. This is an event-driven one-shot,
  // not derived state, so it must live in an effect.
  useEffect(() => {
    if (!isToday || !activityToStartOnToday) return;
    const activityId = activityToStartOnToday;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the consumed one-shot intent after acting on it
    setActivityToStartOnToday(null);
    handleStartActivity(activityId);
  }, [isToday, activityToStartOnToday, handleStartActivity]);
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
    const [y, m, d] = currentDate
      .toISOString()
      .split("T")[0]
      .split("-")
      .map(Number);
    const dayStart = new Date(y, (m || 1) - 1, d || 1);
    dayStart.setHours(Math.floor(resetMin / 60), resetMin % 60, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const fmt = (date: Date) =>
      date.toLocaleDateString(getActiveLocaleTag(), {
        month: "short",
        day: "numeric",
      });

    return {
      top: `${resetLabel} ${fmt(dayEnd)}`,
      bottom: `${resetLabel} ${fmt(dayStart)}`,
    };
  }, [resetMin, currentDate]);

  const handleAssignSuccess = () => {
    void loadActivityPeriods();
  };

  const handleStartActivityFromPastDay = (activityId: string) => {
    if (isToday) {
      handleStartActivity(activityId);
    } else {
      // Set the activity to start and navigate to today
      setActivityToStartOnToday(activityId);
      const today = new Date(getEffectiveToday() + "T12:00:00");
      onDateChange(today);
    }
  };

  return (
    <div className="flex flex-col">
      {(oneTimeTasks.length > 0 || isToday) && (
        <div className="mb-4 space-y-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("sections.memos")}
            </p>
            <div className="flex w-full gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRecurringMemosDialogOpen(true);
                }}
                className="h-7 min-w-0 flex-1 gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground shadow-none"
                aria-label={t("manageRecurringMemos")}
              >
                <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("recurringMemosButton")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void loadArchivedMemos();
                  setArchivedMemosDialogOpen(true);
                }}
                className="h-7 min-w-0 flex-1 gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground shadow-none"
                aria-label={t("viewArchivedMemos")}
              >
                <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("archiveButton")}
              </Button>
            </div>
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
                void loadOneTimeTasks();
                void loadArchivedMemos();
              }}
            />
          ))}
        </div>
      )}

      {(loading || dailyActivities.length > 0) && (
        <>
          <div className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("sections.forToday")}
            </p>
          </div>

          <div className="flex-1 space-y-2">
            {loading && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("loading")}
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
                  onNeverIncrement={incrementNeverSlip}
                  onNeverReset={resetNeverTaskCount}
                  onStartActivity={handleStartActivity}
                  onStopActivity={handleStopActivity}
                  onManualEntry={setManualEntryActivityId}
                  onShowStats={setStatsActivity}
                  onShowRetiredInfo={(kind, activityName) =>
                    setRetiredInfo({ kind, activityName })
                  }
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
              title={isBreakDay ? t("breakDay.unset") : t("breakDay.set")}
            >
              <Palmtree className="h-3.5 w-3.5" />
              {isBreakDay ? t("breakDay.active") : t("breakDay.markAsBreakDay")}
            </Button>
            {!isBreakDay && (
              <p className="text-center text-[11px] text-muted-foreground">
                {t("breakDay.helper")}
              </p>
            )}
          </div>
        </>
      )}

      {(currentActivityId || timelineSessions.length > 0) && (
        <div className="mt-6 space-y-2">
          <div className="ml-1 mr-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("sections.timeline")}
              {timelineBoundaryLabels && (
                <span className="ml-1.5 font-normal normal-case">
                  {t("sections.timelineBoundary", {
                    time: formatResetMinutes(resetMin),
                  })}
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
                  !isUnknown ? handleStartActivityFromPastDay : undefined
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

      <RecurringMemosDialog
        open={recurringMemosDialogOpen}
        onOpenChange={setRecurringMemosDialogOpen}
        onPresetsChanged={() => {
          void loadOneTimeTasks();
        }}
      />

      <ActivityStatsDialog
        open={statsActivity !== null}
        onOpenChange={(open) => {
          if (!open) setStatsActivity(null);
        }}
        activity={statsActivity}
        group={statsActivity ? getGroup(statsActivity) : undefined}
      />

      <ActivityRetiredInfoDialog
        open={retiredInfo !== null}
        kind={retiredInfo?.kind ?? null}
        activityName={retiredInfo?.activityName ?? ""}
        onOpenChange={(open) => {
          if (!open) setRetiredInfo(null);
        }}
      />
    </div>
  );
}
