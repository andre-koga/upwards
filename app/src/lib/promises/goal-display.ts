import type { Goal } from "@/lib/db/types";
import {
  isNeverRoutine,
  isNeverTaskSlipped,
  neverTaskTarget,
} from "@/lib/activity/never-task";

export const GOAL_NAME_MAX_LENGTH = 30;
export const GOAL_DESCRIPTION_MAX_LENGTH = 100;

/** @deprecated use GOAL_NAME_MAX_LENGTH */
export const GOAL_TITLE_MAX_LENGTH = GOAL_NAME_MAX_LENGTH;
/** @deprecated use GOAL_DESCRIPTION_MAX_LENGTH */
export const GOAL_OBJECTIVE_MAX_LENGTH = GOAL_DESCRIPTION_MAX_LENGTH;

export function getGoalDisplayName(goal: Pick<Goal, "name" | "activity_name">): string {
  if (goal.name?.trim()) return goal.name.trim();
  if (goal.activity_name?.trim()) return goal.activity_name.trim();
  return "Goal";
}

export function getGoalDescription(
  goal: Pick<Goal, "description">
): string | null {
  const description = goal.description?.trim();
  return description ? description : null;
}

/** @deprecated */
export const getGoalDisplayTitle = getGoalDisplayName;
/** @deprecated */
export const getGoalObjective = getGoalDescription;

export function formatGoalTargetShort(goal: Goal): string {
  if (goal.target_kind === "streak_count" && goal.target_streak != null) {
    return `${goal.target_streak}-day streak`;
  }
  if (goal.target_kind === "streak_until" && goal.target_end_date != null) {
    const d = new Date(goal.target_end_date + "T00:00:00");
    return `Until ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  return "No target";
}

export function viewerDisplayLabel(
  displayName: string | null,
  username: string | null
): string {
  if (displayName?.trim()) {
    return displayName.trim().split(/\s+/)[0] ?? displayName.trim();
  }
  if (username?.trim()) return username.trim();
  return "Friend";
}

type LinkedActivityRef = {
  id: string;
  routine?: string | null;
  completion_target?: number | null;
};

export function getEffectiveGoalStreak(params: {
  activity: LinkedActivityRef | undefined;
  activityId: string | null;
  activityStreaks: Record<string, number>;
  taskCounts: Record<string, number>;
  remoteStreak?: number;
  isSelf: boolean;
}): number {
  const { activity, activityId, activityStreaks, taskCounts, remoteStreak = 0, isSelf } =
    params;

  if (!activityId) return 0;

  const cached = isSelf ? (activityStreaks[activityId] ?? 0) : remoteStreak;

  if (isSelf && isNeverRoutine(activity)) {
    const count = taskCounts[activityId] ?? 0;
    if (isNeverTaskSlipped(count, neverTaskTarget(activity ?? {}))) {
      return 0;
    }
  }

  return cached;
}
