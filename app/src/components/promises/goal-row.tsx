import { memo } from "react";
import { Eye, Flame } from "lucide-react";
import type { GoalWithShares } from "@/lib/db/types";
import {
  computeGoalProgress,
  getGoalActivityId,
} from "@/lib/promises/use-goal-progress";
import {
  formatGoalTargetShort,
  getEffectiveGoalStreak,
  getGoalDisplayName,
} from "@/lib/promises/goal-display";
import type { Activity } from "@/lib/db/types";
import { cn } from "@/lib/utils";

interface GoalRowProps {
  goal: GoalWithShares;
  activityStreaks: Record<string, number>;
  taskCounts: Record<string, number>;
  pausedTaskIds: string[];
  isBreakDay: boolean;
  isEditableDate: boolean;
  viewDate: Date;
  activities: Activity[];
  onClick: () => void;
}

function formatCardStreakLine(
  goal: GoalWithShares,
  currentStreak: number,
  targetReached: boolean,
  periodEnded: boolean
): string {
  if (targetReached || periodEnded) {
    return formatGoalTargetShort(goal);
  }
  if (goal.target_kind === "streak_count" && goal.target_streak != null) {
    return `${currentStreak} / ${goal.target_streak} day streak`;
  }
  return `${currentStreak}d · ${formatGoalTargetShort(goal)}`;
}

export const GoalRow = memo(function GoalRow({
  goal,
  activityStreaks,
  taskCounts,
  pausedTaskIds,
  isBreakDay,
  isEditableDate,
  viewDate,
  activities,
  onClick,
}: GoalRowProps) {
  const activityId = getGoalActivityId(goal);
  const linkedActivity = activityId
    ? activities.find((activity) => activity.id === activityId)
    : undefined;
  const currentStreak = getEffectiveGoalStreak({
    activity: linkedActivity,
    activityId,
    activityStreaks,
    taskCounts,
    isSelf: true,
  });
  const { progressPercent, targetReached, periodEnded } = computeGoalProgress(
    goal,
    currentStreak,
    viewDate
  );
  const isGoalReached = targetReached || periodEnded;
  const progressBarWidth = isGoalReached ? 100 : (progressPercent ?? 0);
  const goalTitle = getGoalDisplayName(goal);
  const activityName = goal.activity_name?.trim() ?? "Habit";
  const viewerCount = goal.shares.filter((s) => s.status === "accepted").length;
  const streakLine = formatCardStreakLine(
    goal,
    currentStreak,
    targetReached,
    periodEnded
  );

  void pausedTaskIds;
  void isBreakDay;
  void isEditableDate;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded-xl border text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isGoalReached
          ? "border-green-500/40 bg-green-50/50 hover:bg-green-50/70 dark:border-green-500/30 dark:bg-green-950/25 dark:hover:bg-green-950/35"
          : "border-border/80 bg-muted/20 hover:bg-muted/35"
      )}
    >
      <div
        className={cn("h-1 w-full", isGoalReached ? "bg-green-500/20" : "bg-muted")}
        aria-hidden="true"
      >
        <div
          className={cn(
            "h-full transition-[width] duration-300",
            isGoalReached ? "bg-green-500 dark:bg-green-400" : "bg-primary"
          )}
          style={{ width: `${progressBarWidth}%` }}
        />
      </div>

      <div className="space-y-1 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-semibold leading-tight">
            {goalTitle}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground">
            <Flame className="h-3.5 w-3.5 shrink-0 text-foreground" />
            <span className="whitespace-nowrap tabular-nums">{streakLine}</span>
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {activityName}
          </span>
          {viewerCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
              <Eye className="h-3 w-3" />
              {viewerCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
});
