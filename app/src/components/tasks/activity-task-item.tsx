import { memo, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import Pill from "@/components/ui/pill";

interface ActivityTaskItemProps {
  activity: Activity;
  group: ActivityGroup | undefined;
  count: number;
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
  const groupColor = group?.color || "#cccccc";

  return (
    <div className="flex items-center gap-2">
      {isNeverTask ? (
        <div
          onClick={isToday ? () => onIncrement(activity.id, target) : undefined}
          className={`flex items-center justify-center h-7 w-[2.75rem] rounded-md border border-destructive transition-colors ${
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
        <button
          onClick={isToday ? () => onIncrement(activity.id, target) : undefined}
          disabled={!isToday}
          className={`flex items-center justify-center h-7 w-[2.75rem] rounded-full border transition-colors ${
            isComplete
              ? "bg-primary text-primary-foreground border-primary"
              : "border-muted-foreground text-muted-foreground"
          } disabled:opacity-60 disabled:cursor-default`}
          title={
            isToday
              ? isComplete
                ? "Mark incomplete"
                : "Mark complete"
              : undefined
          }
        >
          {isComplete && <Check className="h-4 w-4" />}
        </button>
      ) : (
        <button
          onClick={isToday ? () => onIncrement(activity.id, target) : undefined}
          disabled={!isToday}
          className={`flex items-center justify-center min-w-[2.75rem] h-7 rounded-full text-xs font-semibold px-2 border transition-colors ${
            isComplete
              ? "bg-primary text-primary-foreground border-primary"
              : count > 0
                ? "bg-primary/20 text-primary border-primary/40"
                : "border-muted-foreground text-muted-foreground"
          } disabled:opacity-60 disabled:cursor-default`}
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
    </div>
  );
}

export default memo(ActivityTaskItem);
