import { memo, useEffect, useRef, useState } from "react";
import { Flame, X } from "lucide-react";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { getActivityDisplayName } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { HOLD_ACTION_DELAY_MS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

  const neverLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const neverLongPressFiredRef = useRef(false);
  const neverPointerLeftRef = useRef(false);
  const pauseLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const suppressNextPlayStopClickRef = useRef(false);

  useEffect(() => {
    return () => {
      if (neverLongPressTimerRef.current != null) {
        clearTimeout(neverLongPressTimerRef.current);
      }
      if (pauseLongPressTimerRef.current != null) {
        clearTimeout(pauseLongPressTimerRef.current);
      }
    };
  }, []);

  const clearNeverLongPressTimer = () => {
    if (neverLongPressTimerRef.current != null) {
      clearTimeout(neverLongPressTimerRef.current);
      neverLongPressTimerRef.current = null;
    }
  };

  const clearPauseLongPressTimer = () => {
    if (pauseLongPressTimerRef.current != null) {
      clearTimeout(pauseLongPressTimerRef.current);
      pauseLongPressTimerRef.current = null;
    }
  };

  const handlePauseHoldStart = () => {
    if (!isToday || isNeverTask) return;
    clearPauseLongPressTimer();
    pauseLongPressTimerRef.current = setTimeout(() => {
      pauseLongPressTimerRef.current = null;
      suppressNextPlayStopClickRef.current = true;
      onTogglePaused(activity.id);
    }, HOLD_ACTION_DELAY_MS);
  };

  const handlePauseHoldEnd = () => {
    clearPauseLongPressTimer();
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
                  }, HOLD_ACTION_DELAY_MS);
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
          {!isComplete ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold leading-none">
              <Flame className="h-3 w-3 fill-foreground" />
              <span className="mt-0.5 font-mono tabular-nums">{streak}</span>
            </span>
          ) : count === 1 ? (
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          ) : count > 1 ? (
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
          completeContent={
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold leading-none">
              <Flame className="h-3 w-3 fill-background" />
              <span className="mt-0.5 font-mono tabular-nums">{streak}</span>
            </span>
          }
          className={
            isBreakDay || isPaused
              ? isComplete
                ? "border-amber-500 bg-amber-500 text-amber-950"
                : "border-amber-500/60 bg-amber-500/10 text-amber-500"
              : ""
          }
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={
            canUpdateCount ? () => onIncrement(activity.id, target) : undefined
          }
          disabled={!canUpdateCount}
          className={cn(
            "h-7 min-h-[1.75rem] min-w-[2.75rem] rounded-full px-2 text-xs font-semibold shadow-none disabled:cursor-default disabled:opacity-60",
            isBreakDay || isPaused
              ? isComplete
                ? "border-amber-500 bg-amber-500 text-amber-950 hover:bg-amber-500"
                : count > 0
                  ? "border-amber-500/80 bg-amber-500/20 text-amber-700 hover:bg-amber-500/25"
                  : "border-amber-500/60 bg-amber-500/10 text-amber-500 hover:bg-amber-500/15"
              : isComplete
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : count > 0
                  ? "border-primary/40 bg-primary/20 text-primary hover:bg-primary/25"
                  : "border-muted-foreground text-muted-foreground"
          )}
          title={
            canUpdateCount
              ? `${count} / ${target} — click to increment`
              : `${count} / ${target}`
          }
        >
          {isComplete ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold leading-none">
              <Flame className="h-3 w-3 fill-background" />
              <span className="mt-0.5 font-mono tabular-nums">{streak}</span>
            </span>
          ) : (
            <p className="pt-0.5 font-mono">
              {count}/{target}
            </p>
          )}
        </Button>
      )}

      <div
        className="flex-1"
        onPointerDown={
          isToday && !isNeverTask ? handlePauseHoldStart : undefined
        }
        onPointerUp={isToday && !isNeverTask ? handlePauseHoldEnd : undefined}
        onPointerCancel={
          isToday && !isNeverTask ? handlePauseHoldEnd : undefined
        }
        onContextMenu={
          isToday && !isNeverTask ? (e) => e.preventDefault() : undefined
        }
        title={
          isToday && !isNeverTask
            ? isPaused
              ? "Hold to resume task for this day"
              : "Hold to pause task for this day"
            : undefined
        }
      >
        <Pill
          name={getActivityDisplayName(activity, group)}
          color={groupColor}
          elapsedMs={timeSpent}
          isRunning={isCurrentActivity}
          onPlayStop={
            isToday && !isPaused
              ? () => {
                  if (suppressNextPlayStopClickRef.current) {
                    suppressNextPlayStopClickRef.current = false;
                    return;
                  }
                  if (isCurrentActivity) {
                    onStopActivity();
                    return;
                  }
                  onStartActivity(activity.id);
                }
              : undefined
          }
          nameClassName={isComplete ? "line-through text-muted-foreground" : ""}
          readOnly={!isToday}
        />
      </div>
    </div>
  );
}

export default memo(ActivityTaskItem);
