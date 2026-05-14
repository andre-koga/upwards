import { memo, useEffect, useRef, useState } from "react";
import { Flame, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { getActivityDisplayName } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ActivityPill from "@/components/activities/activity-pill";
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
  /** "Never" tasks: tap increments slip count. */
  onNeverIncrement?: () => void;
  /** "Never" tasks: hold to clear slip count. */
  onNeverReset?: () => void;
  onStartActivity: (activityId: string) => void;
  onStopActivity: () => void;
  onManualEntry?: (activityId: string) => void;
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
  onStartActivity,
  onStopActivity,
  onManualEntry,
}: ActivityTaskItemProps) {
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const neverPressTimeoutRef = useRef<number | null>(null);
  const longPressHandledRef = useRef(false);

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

  const clearNeverPressTimeout = () => {
    if (neverPressTimeoutRef.current === null) return;
    window.clearTimeout(neverPressTimeoutRef.current);
    neverPressTimeoutRef.current = null;
  };

  useEffect(
    () => () => {
      clearNeverPressTimeout();
    },
    []
  );

  return (
    <div className="flex items-center gap-2">
      {isNeverTask ? (
        <Button
          type="button"
          variant="bare"
          onClick={
            canUpdateCount && onNeverIncrement
              ? () => {
                  if (longPressHandledRef.current) {
                    longPressHandledRef.current = false;
                    return;
                  }
                  onNeverIncrement();
                }
              : undefined
          }
          onPointerDown={
            canUpdateCount && onNeverReset && count > 0
              ? () => {
                  longPressHandledRef.current = false;
                  clearNeverPressTimeout();
                  neverPressTimeoutRef.current = window.setTimeout(() => {
                    longPressHandledRef.current = true;
                    onNeverReset();
                    neverPressTimeoutRef.current = null;
                  }, 500);
                }
              : undefined
          }
          onPointerUp={clearNeverPressTimeout}
          onPointerLeave={clearNeverPressTimeout}
          onPointerCancel={clearNeverPressTimeout}
          className={`flex h-7 min-w-[2.75rem] touch-manipulation items-center justify-center rounded-md border px-1 transition-colors ${
            canUpdateCount ? "cursor-pointer" : "cursor-default text-muted-foreground"
          } ${
            isComplete
              ? "border-destructive bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)]"
              : count > 0
                ? "border-destructive bg-[color-mix(in_srgb,hsl(var(--destructive))_18%,hsl(var(--background)))] text-destructive hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_28%,hsl(var(--background)))]"
                : "border-destructive bg-transparent hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_12%,hsl(var(--background)))]"
          }`}
          title={
            canUpdateCount
              ? "Tap to add a slip. Hold to clear slips."
              : undefined
          }
          disabled={!canUpdateCount}
        >
          {!isComplete ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold leading-none">
              <Flame className="h-3 w-3 fill-current" />
              <span className="mt-0.5 font-mono tabular-nums">{streak}</span>
            </span>
          ) : count === 1 ? (
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          ) : count > 1 ? (
            <span className="mt-0.5 font-mono text-xs font-semibold tabular-nums leading-none">
              {count}
            </span>
          ) : null}
        </Button>
      ) : target <= 1 ? (
        <TaskCheckbox
          isComplete={isComplete}
          isToday={canUpdateCount}
          onClick={() => onIncrement(activity.id, target)}
          title={isPaused ? "Task paused for this day" : undefined}
          completeContent={
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold leading-none">
              <Flame className="h-3 w-3 fill-current" />
              <span className="mt-0.5 font-mono tabular-nums">{streak}</span>
            </span>
          }
          className={
            isBreakDay || isPaused
              ? isComplete
                ? "border-amber-500 bg-amber-500 text-amber-950"
                : "border-[color-mix(in_srgb,rgb(245_158_11)_62%,hsl(var(--border)))] bg-[color-mix(in_srgb,rgb(245_158_11)_12%,hsl(var(--background)))] text-amber-500"
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
            "h-7 min-h-[1.75rem] min-w-[2.75rem] rounded-full px-2 text-xs font-semibold shadow-none disabled:cursor-default",
            isBreakDay || isPaused
              ? isComplete
                ? "border-amber-500 bg-amber-500 text-amber-950"
                : count > 0
                  ? "border-[color-mix(in_srgb,rgb(245_158_11)_82%,hsl(var(--border)))] bg-[color-mix(in_srgb,rgb(245_158_11)_22%,hsl(var(--background)))] text-amber-700"
                  : "border-[color-mix(in_srgb,rgb(245_158_11)_62%,hsl(var(--border)))] bg-[color-mix(in_srgb,rgb(245_158_11)_12%,hsl(var(--background)))] text-amber-500"
              : isComplete
                ? "border-primary bg-primary text-primary-foreground"
                : count > 0
                  ? "border-primary bg-[color-mix(in_srgb,hsl(var(--primary))_22%,hsl(var(--background)))] text-primary"
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
              <Flame className="h-3 w-3 fill-current" />
              <span className="mt-0.5 font-mono tabular-nums">{streak}</span>
            </span>
          ) : (
            <p className="pt-0.5 font-mono">
              {count}/{target}
            </p>
          )}
        </Button>
      )}

      <div className="flex-1">
        <ActivityPill
          name={getActivityDisplayName(activity, group)}
          color={groupColor}
          elapsedMs={timeSpent}
          isRunning={isCurrentActivity}
          onClick={
            isToday && !isPaused
              ? () => {
                  if (isCurrentActivity) {
                    onStopActivity();
                    return;
                  }
                  onStartActivity(activity.id);
                }
              : undefined
          }
          onManualEntry={
            isToday && !isPaused && onManualEntry
              ? () => onManualEntry(activity.id)
              : undefined
          }
          onNameClick={() => {
            navigate(`/activities/stats/${activity.id}`);
          }}
          nameClassName={isComplete ? "line-through text-muted-foreground" : ""}
          readOnly={!isToday}
        />
      </div>
    </div>
  );
}

export default memo(ActivityTaskItem);
