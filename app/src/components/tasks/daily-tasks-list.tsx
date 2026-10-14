import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Activity } from "@/lib/db/types";
import ActivityTaskItem from "./activity-task-item";
import ActivityTimelineItem from "./activity-timeline-item";
import OneTimeTaskItem from "./one-time-task-item";
import AssignActivityDialog from "./assign-activity-dialog";
import { useDailyTasks } from "./hooks/use-daily-tasks";
import ManualTimeEntryDialog from "./manual-time-entry-dialog";
import { ArchivedMemosDialog } from "./archived-memos-dialog";
import { Palmtree, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TodayRow, TodaySection } from "./today-section";
import { cn } from "@/lib/utils";
import SessionDetailsDialog from "@/components/activities/session-details-dialog";
import { ActivityDialogForm } from "@/components/activities/activity-dialog-form";
import {
  ActivityRetiredInfoDialog,
  type ActivityRetiredKind,
} from "@/components/activities/activity-retired-info-dialog";
import { todayDateString } from "@/lib/time-utils";
import {
  canMoveActivity,
  orderActivitiesForToday,
  planActivityMove,
} from "@/lib/activity/today-order";
import { setDoneLast, useDoneLast } from "@/lib/today-order-preference";
import { getActivityDisplayName } from "@/lib/activity";
import { now } from "@/lib/db";
import { logError } from "@/lib/error-utils";
import { patchActivity } from "@/lib/sync/mutate-synced";
import {
  TodayOrderControls,
  TodayOrderStatus,
  type TodayOrderState,
} from "./today-order-controls";
import { useAiTodayOrder } from "./hooks/use-ai-today-order";

export type DailyTasksState = ReturnType<typeof useDailyTasks>;

interface DailyTasksListProps {
  /** Active habits — used for starting new tracking. */
  activities: Activity[];
  /**  */
  daily: DailyTasksState;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onTasksDataChanged?: () => void;
}

export default function DailyTasksList({
  activities,
  daily,
  currentDate,
  onDateChange,
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
  const [activityToStartOnToday, setActivityToStartOnToday] = useState<
    string | null
  >(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [retiredInfo, setRetiredInfo] = useState<{
    kind: ActivityRetiredKind;
    activityName: string;
  } | null>(null);

  const {
    isToday,
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
    loadActivityPeriods,
    getActivityElapsedMs,
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
  const getName = useCallback(
    (activity: Activity) =>
      getActivityDisplayName(activity, getGroup(activity)),
    [getGroup]
  );
  const aiOrder = useAiTodayOrder({
    enabled: isToday,
    today: todayDateString(),
    activities: dailyActivities,
    getName,
    counts: taskCounts,
    streaks: activityStreaks,
  });
  const doneLast = useDoneLast();
  const orderOptions = useMemo(() => ({ doneLast }), [doneLast]);
  // Pinned first, then not yet done (unless done habits stay in place), then
  // the AI's order while the person is looking at one, else their own stored
  // order. Pins always win.
  const orderedActivities = useMemo(
    () =>
      orderActivitiesForToday(
        dailyActivities,
        taskCounts,
        aiOrder.ranking,
        orderOptions
      ),
    [dailyActivities, taskCounts, aiOrder.ranking, orderOptions]
  );
  const aiOrderInView = aiOrder.generatedAt !== null;
  const [reorderRequested, setReorderRequested] = useState(false);
  const reordering = isToday && reorderRequested && !aiOrderInView;
  const moveInFlight = useRef(false);

  // A reload after a move hands back fresh rows; until then a second tap would
  // plan against the old order and undo the first.
  useEffect(() => {
    moveInFlight.current = false;
  }, [orderedActivities]);

  const moveActivity = useCallback(
    async (activity: Activity, direction: -1 | 1) => {
      if (moveInFlight.current) return;
      const patches = planActivityMove(
        activities,
        orderedActivities,
        activity.id,
        direction,
        taskCounts,
        orderOptions
      );
      if (patches.length === 0) return;
      moveInFlight.current = true;
      try {
        const updated_at = now();
        for (const patch of patches) {
          await patchActivity(patch.id, {
            order_index: patch.order_index,
            updated_at,
          });
        }
        onTasksDataChanged?.();
      } catch (error) {
        moveInFlight.current = false;
        logError("Error reordering activities", error);
      }
    },
    [
      activities,
      orderedActivities,
      taskCounts,
      orderOptions,
      onTasksDataChanged,
    ]
  );
  const togglePin = useCallback(
    async (activity: Activity) => {
      await patchActivity(activity.id, {
        is_pinned: activity.is_pinned !== true,
        updated_at: now(),
      });
      onTasksDataChanged?.();
    },
    [onTasksDataChanged]
  );
  const manualEntryActivity = manualEntryActivityId
    ? (activities.find((item) => item.id === manualEntryActivityId) ?? null)
    : null;
  const manualEntryGroup = manualEntryActivity
    ? getGroup(manualEntryActivity)
    : undefined;
  const editingGroup = editingActivity ? getGroup(editingActivity) : undefined;

  const openAssignDialog = (periodId: string, intervalMs: number) => {
    setAssignPeriodId(periodId);
    setAssignIntervalMs(intervalMs);
    setAssignDialogOpen(true);
  };

  const handleAssignSuccess = () => {
    void loadActivityPeriods();
  };

  const handleStartActivityFromPastDay = (activityId: string) => {
    if (isToday) {
      handleStartActivity(activityId);
    } else {
      // Set the activity to start and navigate to today
      setActivityToStartOnToday(activityId);
      const today = new Date(todayDateString() + "T12:00:00");
      onDateChange(today);
    }
  };

  const orderState: TodayOrderState = {
    aiCanOrder: aiOrder.canOrder,
    aiAvailable: aiOrder.available,
    aiLoading: aiOrder.loading,
    aiError: aiOrder.error,
    aiGeneratedAt: aiOrder.generatedAt,
    aiStale: aiOrder.stale,
    onAiOrder: () => void aiOrder.rank(),
    onAiReset: aiOrder.reset,
    canArrange: dailyActivities.length > 1,
    canReorder: isToday,
    reordering,
    onToggleReorder: () => setReorderRequested((value) => !value),
    doneLast,
    onDoneLastChange: setDoneLast,
  };

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      {(oneTimeTasks.length > 0 || isToday) && (
        <TodaySection
          label={t("sections.memos")}
          aside={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void loadArchivedMemos();
                setArchivedMemosDialogOpen(true);
              }}
              className="-mr-2 h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground"
              aria-label={t("viewArchivedMemos")}
            >
              <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("archiveButton")}
            </Button>
          }
        >
          {oneTimeTasks.map((task) => (
            <TodayRow key={task.id}>
              <OneTimeTaskItem
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
            </TodayRow>
          ))}
        </TodaySection>
      )}

      {(loading || dailyActivities.length > 0) && (
        <TodaySection
          label={t("sections.forToday")}
          aside={loading ? null : <TodayOrderControls {...orderState} />}
        >
          {loading ? null : <TodayOrderStatus {...orderState} />}

          {loading && (
            <p className="px-4 py-4 text-center text-sm text-muted-foreground">
              {t("loading")}
            </p>
          )}
          {!loading &&
            orderedActivities.map((activity) => (
              <TodayRow key={activity.id}>
                <ActivityTaskItem
                  activity={activity}
                  group={getGroup(activity)}
                  count={taskCounts[activity.id] || 0}
                  streak={activityStreaks[activity.id] || 0}
                  timeSpent={getActivityElapsedMs(activity.id)}
                  isPaused={pausedTaskIdSet.has(activity.id)}
                  isBreakDay={isBreakDay}
                  isCurrentActivity={currentActivityId === activity.id}
                  temporal={temporalForViewDate}
                  onIncrement={incrementTask}
                  onNeverIncrement={incrementNeverSlip}
                  onNeverReset={resetNeverTaskCount}
                  onStartActivity={handleStartActivity}
                  onStopActivity={handleStopActivity}
                  onManualEntry={setManualEntryActivityId}
                  onEdit={setEditingActivity}
                  onShowRetiredInfo={(kind, activityName) =>
                    setRetiredInfo({ kind, activityName })
                  }
                  onTogglePin={togglePin}
                  reason={aiOrder.reasons.get(activity.id)}
                  reorder={
                    reordering
                      ? {
                          canMoveUp: canMoveActivity(
                            orderedActivities,
                            activity.id,
                            -1,
                            taskCounts,
                            orderOptions
                          ),
                          canMoveDown: canMoveActivity(
                            orderedActivities,
                            activity.id,
                            1,
                            taskCounts,
                            orderOptions
                          ),
                          onMove: (item, direction) =>
                            void moveActivity(item, direction),
                        }
                      : undefined
                  }
                />
              </TodayRow>
            ))}

          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            {isBreakDay ? (
              <span />
            ) : (
              <p className="min-w-0 text-xs text-muted-foreground">
                {t("breakDay.helper")}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void toggleBreakDay();
              }}
              className={cn(
                "shrink-0 gap-1.5 rounded-full px-3 text-xs font-medium shadow-none",
                isBreakDay ? "text-gold-text" : "text-muted-foreground"
              )}
              aria-pressed={isBreakDay}
              title={isBreakDay ? t("breakDay.unset") : t("breakDay.set")}
            >
              <Palmtree className="h-3.5 w-3.5" aria-hidden />
              {isBreakDay ? t("breakDay.active") : t("breakDay.markAsBreakDay")}
            </Button>
          </div>
        </TodaySection>
      )}

      {timelineSessions.length > 0 && (
        <TodaySection
          label={t("sections.timeline")}
          aside={
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatTimerDisplay(
                timelineSessions.reduce(
                  (total, session) => total + session.intervalMs,
                  0
                )
              )}
            </span>
          }
        >
          <div className="space-y-1 p-2">
            {timelineSessions.map((session) => {
              const isUnknown = !session.groupId;
              return (
                <ActivityTimelineItem
                  key={session.id}
                  activityName={session.name}
                  groupColor={session.groupColor}
                  intervalMs={session.intervalMs}
                  activityId={session.activityId || ""}
                  note={session.note}
                  untimed={session.untimed}
                  completedAtIso={session.completedAtIso}
                  fromPreviousDay={session.fromPreviousDay}
                  continuesNextDay={session.continuesNextDay}
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
                    !isUnknown && !session.untimed
                      ? handleStartActivityFromPastDay
                      : undefined
                  }
                />
              );
            })}
          </div>
        </TodaySection>
      )}

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

      {editingActivity && editingGroup ? (
        <ActivityDialogForm
          open={editingActivity !== null}
          onOpenChange={(open) => {
            if (!open) setEditingActivity(null);
          }}
          group={editingGroup}
          activity={editingActivity}
          onSaved={() => {
            setEditingActivity(null);
            onTasksDataChanged?.();
          }}
          onArchived={() => {
            setEditingActivity(null);
            onTasksDataChanged?.();
          }}
        />
      ) : null}

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
