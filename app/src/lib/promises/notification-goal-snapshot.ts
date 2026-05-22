import type { Goal } from "@/lib/db/types";
import { computeGoalProgress } from "@/lib/promises/use-goal-progress";

export type GoalDetailsForSnapshot = Pick<
  Goal,
  | "target_kind"
  | "target_streak"
  | "target_end_date"
  | "created_at"
  | "status"
>;

export interface GoalProgressSnapshot {
  progressPercent: number | null;
  targetReached: boolean;
  periodEnded: boolean;
  statusLabel: string;
}

export function buildGoalProgressSnapshot(
  goal: GoalDetailsForSnapshot | undefined,
  streak: number | undefined,
  asOf: Date = new Date()
): GoalProgressSnapshot {
  if (!goal) {
    return {
      progressPercent: null,
      targetReached: false,
      periodEnded: false,
      statusLabel: "Active",
    };
  }

  if (goal.status === "completed") {
    return {
      progressPercent: 100,
      targetReached: true,
      periodEnded: false,
      statusLabel: "Completed",
    };
  }

  if (goal.status === "cancelled") {
    return {
      progressPercent: null,
      targetReached: false,
      periodEnded: false,
      statusLabel: "Cancelled",
    };
  }

  const progress = computeGoalProgress(goal, streak ?? 0, asOf);
  const statusLabel = progress.targetReached
    ? "Target reached"
    : progress.periodEnded
      ? "Period ended"
      : "In progress";

  return {
    progressPercent: progress.progressPercent,
    targetReached: progress.targetReached,
    periodEnded: progress.periodEnded,
    statusLabel,
  };
}
