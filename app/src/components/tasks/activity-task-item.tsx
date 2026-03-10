import { memo, useEffect, useState } from "react";
import { X, Flame } from "lucide-react";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import Pill from "@/components/ui/pill";
import TaskCheckbox from "@/components/tasks/task-checkbox";

interface ActivityTaskItemProps {
  activity: Activity;
  group: ActivityGroup | undefined;
  count: number;
  streak: number;
  timeSpent: number;
  isCurrentActivity: boolean;
  isToday: boolean;
  onIncrement: (activityId: string, target: number) => void;
  onStartActivity: (activityId: string) => void;
  onStopActivity: () => void;
}

function ActivityTaskItem({
  activity,
  group,
  count,
  streak,
  timeSpent,
  isCurrentActivity,
  isToday,
  onIncrement,
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
  const isComplete = count >= target;
  const isNeverTask = activity.routine === "never";
  const groupColor = group?.color || DEFAULT_GROUP_COLOR;
  const streakColorClass =
    streak === 0
      ? "text-muted-foreground"
      : streak <= 5
        ? "text-yellow-500"
        : streak <= 25
          ? "text-orange-500"
          : "text-red-500";

  return (
    <div className="flex items-center gap-2">
      {isNeverTask ? (
        <div
          onClick={isToday ? () => onIncrement(activity.id, target) : undefined}
          className={`flex h-7 w-[2.75rem] items-center justify-center rounded-md border border-destructive transition-colors ${
            isToday ? "cursor-pointer" : "cursor-default opacity-60"
          } ${isComplete ? "bg-destructive" : "bg-transparent"}`}
          role={isToday ? "button" : undefined}
          tabIndex={isToday ? 0 : undefined}
          onKeyDown={
            isToday
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onIncrement(activity.id, target);
                  }
                }
              : undefined
          }
        >
          {isComplete && <X className="h-4 w-4 text-destructive-foreground" />}
        </div>
      ) : target <= 1 ? (
        <TaskCheckbox
          isComplete={isComplete}
          isToday={isToday}
          onClick={() => onIncrement(activity.id, target)}
        />
      ) : (
        <button
          onClick={isToday ? () => onIncrement(activity.id, target) : undefined}
          disabled={!isToday}
          className={`flex h-7 min-w-[2.75rem] items-center justify-center rounded-full border px-2 text-xs font-semibold transition-colors ${
            isComplete
              ? "border-primary bg-primary text-primary-foreground"
              : count > 0
                ? "border-primary/40 bg-primary/20 text-primary"
                : "border-muted-foreground text-muted-foreground"
          } disabled:cursor-default disabled:opacity-60`}
          title={
            isToday
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
        name={activity.name}
        color={groupColor}
        elapsedMs={timeSpent}
        isRunning={isCurrentActivity}
        onPlayStop={
          isToday
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
