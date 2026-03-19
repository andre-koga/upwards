/**
 * SRP: Renders one activity row with completion, pause state, timer, and streak controls.
 */
import { memo, useEffect, useRef, useState } from "react";
import { Flame, Pause, Play } from "lucide-react";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { getActivityDisplayName } from "@/lib/activity-utils";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import Pill from "@/components/ui/pill";
import TaskCheckbox from "@/components/tasks/task-checkbox";

interface ActivityTaskItemProps {
  activity: Activity;
  group: ActivityGroup | undefined;
  count: number;
  streak: number;
  timeSpent: number;
  isPaused: boolean;
  isBreakDay: boolean;
  isCurrentActivity: boolean;
  isToday: boolean;
  onIncrement: (activityId: string, target: number) => void;
  /** "Never" tasks: tap increments slip count; hold resets count (see pointer handlers). */
  onNeverIncrement?: () => void;
  onNeverReset?: () => void;
  onTogglePaused: (activityId: string) => void;
  onStartActivity: (activityId: string) => void;
  onStopActivity: () => void;
}

function ActivityTaskItem({
  activity,
  group,
  count,
  streak,
  timeSpent,
  isPaused,
  isBreakDay,
  isCurrentActivity,
  isToday,
  onIncrement,
  onNeverIncrement,
  onNeverReset,
  onTogglePaused,
  onStartActivity,
  onStopActivity,
}: ActivityTaskItemProps) {
  const [, setTick] = useState(0);

  // Only update this specific item when it's running
  useEffect(() => {
    if (!isCurrentActivity) return;
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isCurrentActivity]);

  const target = activity.completion_target ?? 1;
  const isNeverTask = activity.routine === "never";
  const isComplete = isNeverTask
    ? count >= target
    : !isPaused && count >= target;
  const groupColor = group?.color || DEFAULT_GROUP_COLOR;
  const canUpdateCount = isToday && (!isPaused || isNeverTask);
  const streakColorClass =
    streak === 0
      ? "text-muted-foreground"
      : streak <= 5
        ? "text-yellow-500"
        : streak <= 25
          ? "text-orange-500"
          : "text-red-500";

  const NEVER_LONG_PRESS_MS = 500;
  const neverLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const neverLongPressFiredRef = useRef(false);
  const neverPointerLeftRef = useRef(false);

  useEffect(() => {
    return () => {
      if (neverLongPressTimerRef.current != null) {
        clearTimeout(neverLongPressTimerRef.current);
      }
    };
  }, []);

  const clearNeverLongPressTimer = () => {
    if (neverLongPressTimerRef.current != null) {
      clearTimeout(neverLongPressTimerRef.current);
      neverLongPressTimerRef.current = null;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isNeverTask ? (
        <div
          onPointerDown={
            canUpdateCount && onNeverIncrement && onNeverReset
              ? (e) => {
                  neverLongPressFiredRef.current = false;
                  neverPointerLeftRef.current = false;
                  neverLongPressTimerRef.current = setTimeout(() => {
                    neverLongPressTimerRef.current = null;
                    neverLongPressFiredRef.current = true;
                    onNeverReset();
                  }, NEVER_LONG_PRESS_MS);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }
              : undefined
          }
          onPointerUp={
            canUpdateCount && onNeverIncrement
              ? (e) => {
                  clearNeverLongPressTimer();
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                  if (
                    neverLongPressFiredRef.current ||
                    neverPointerLeftRef.current
                  ) {
                    return;
                  }
                  onNeverIncrement();
                }
              : undefined
          }
          onPointerLeave={
            canUpdateCount && onNeverReset
              ? () => {
                  neverPointerLeftRef.current = true;
                  clearNeverLongPressTimer();
                }
              : undefined
          }
          onPointerCancel={
            canUpdateCount
              ? () => {
                  neverPointerLeftRef.current = true;
                  clearNeverLongPressTimer();
                }
              : undefined
          }
          onContextMenu={(e) => e.preventDefault()}
          className={`flex h-7 min-w-[2.75rem] touch-manipulation select-none items-center justify-center rounded-md border px-1 transition-colors ${
            canUpdateCount ? "cursor-pointer" : "cursor-default opacity-60"
          } ${
            isComplete
              ? "border-destructive bg-destructive text-destructive-foreground"
              : count > 0
                ? "border-destructive/80 bg-destructive/15 text-destructive"
                : "border-destructive bg-transparent"
          }`}
          role={canUpdateCount ? "button" : undefined}
          tabIndex={canUpdateCount ? 0 : undefined}
          title={
            canUpdateCount
              ? "Tap to add a slip. First slip fails the day and resets your streak. Hold to reset the slip count."
              : undefined
          }
          onKeyDown={
            canUpdateCount && onNeverIncrement
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onNeverIncrement();
                  }
                }
              : undefined
          }
        >
          {count > 0 ? (
            <span className="mt-0.5 font-mono text-xs font-semibold tabular-nums leading-none">
              {count}
            </span>
          ) : null}
        </div>
      ) : target <= 1 ? (
        <TaskCheckbox
          isComplete={isComplete}
          isToday={canUpdateCount}
          onClick={() => onIncrement(activity.id, target)}
          title={isPaused ? "Task paused for this day" : undefined}
          className={
            isBreakDay || isPaused
              ? isComplete
                ? "border-amber-500 bg-amber-500 text-amber-950"
                : "border-amber-500/60 bg-amber-500/10 text-amber-500"
              : ""
          }
        />
      ) : (
        <button
          onClick={
            canUpdateCount ? () => onIncrement(activity.id, target) : undefined
          }
          disabled={!canUpdateCount}
          className={`flex h-7 min-w-[2.75rem] items-center justify-center rounded-full border px-2 text-xs font-semibold transition-colors ${
            isBreakDay || isPaused
              ? isComplete
                ? "border-amber-500 bg-amber-500 text-amber-950"
                : count > 0
                  ? "border-amber-500/80 bg-amber-500/20 text-amber-700"
                  : "border-amber-500/60 bg-amber-500/10 text-amber-500"
              : isComplete
                ? "border-primary bg-primary text-primary-foreground"
                : count > 0
                  ? "border-primary/40 bg-primary/20 text-primary"
                  : "border-muted-foreground text-muted-foreground"
          } disabled:cursor-default disabled:opacity-60`}
          title={
            canUpdateCount
              ? `${count} / ${target} — click to increment`
              : `${count} / ${target}`
          }
        >
          <p className="pt-0.5 font-mono">
            {count}/{target}
          </p>
        </button>
      )}

      <Pill
        name={getActivityDisplayName(activity, group)}
        color={groupColor}
        elapsedMs={timeSpent}
        isRunning={isCurrentActivity}
        onPlayStop={
          isToday && !isPaused
            ? () =>
                isCurrentActivity
                  ? onStopActivity()
                  : onStartActivity(activity.id)
            : undefined
        }
        nameClassName={isComplete ? "line-through text-muted-foreground" : ""}
        readOnly={!isToday}
        className="flex-1"
      />

      <button
        type="button"
        onClick={
          !isNeverTask && isToday
            ? () => onTogglePaused(activity.id)
            : undefined
        }
        disabled={isNeverTask || !isToday}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
          isPaused
            ? "border-amber-500/60 text-amber-500"
            : "border-muted-foreground/40 text-muted-foreground hover:text-foreground"
        } disabled:cursor-default disabled:opacity-40`}
        title={
          isNeverTask
            ? "Pause is unavailable for never tasks"
            : isPaused
              ? "Resume task for this day"
              : "Pause task for this day"
        }
      >
        {isPaused ? (
          <Play className="h-3.5 w-3.5" />
        ) : (
          <Pause className="h-3.5 w-3.5" />
        )}
      </button>

      <div
        className={`flex items-center gap-0.5 text-sm font-semibold ${streakColorClass}`}
      >
        <Flame className="h-3.5 w-3.5" />
        <span>{streak}</span>
      </div>
    </div>
  );
}

export default memo(ActivityTaskItem);
