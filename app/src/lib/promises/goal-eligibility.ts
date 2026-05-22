import type { Activity, Goal, GoalWithShares } from "@/lib/db/types";
import { getGoalDisplayName } from "@/lib/promises/goal-display";

export type GoalModificationBlockAction = "complete" | "delete" | "archive";

function isOwnedActiveGoal(goal: Goal, userId: string): boolean {
  return goal.user_id === userId && goal.status === "active";
}

export function getActivityIdsWithActiveGoals(
  goals: GoalWithShares[],
  userId: string | null | undefined
): Set<string> {
  const ids = new Set<string>();
  if (!userId) return ids;

  for (const goal of goals) {
    if (!isOwnedActiveGoal(goal, userId)) continue;
    if (goal.activity_id) ids.add(goal.activity_id);
  }

  return ids;
}

export function activityHasActiveGoal(
  activityId: string,
  goals: GoalWithShares[],
  userId: string | null | undefined
): boolean {
  return getActivityIdsWithActiveGoals(goals, userId).has(activityId);
}

export function filterActivitiesWithoutActiveGoals(
  activities: { id: string }[],
  goals: GoalWithShares[],
  userId: string | null | undefined
): { id: string }[] {
  const usedIds = getActivityIdsWithActiveGoals(goals, userId);
  return activities.filter((activity) => !usedIds.has(activity.id));
}

export function getActiveGoalForActivity(
  activityId: string,
  goals: GoalWithShares[],
  userId: string | null | undefined
): Goal | undefined {
  if (!userId) return undefined;

  for (const goal of goals) {
    if (!isOwnedActiveGoal(goal, userId)) continue;
    if (goal.activity_id === activityId) return goal;
  }

  return undefined;
}

export function getActiveGoalBlockingGroup(
  groupId: string,
  activities: Activity[],
  goals: GoalWithShares[],
  userId: string | null | undefined
): Goal | undefined {
  const linkedIds = getActivityIdsWithActiveGoals(goals, userId);
  if (linkedIds.size === 0) return undefined;

  for (const activity of activities) {
    if (activity.group_id !== groupId || !linkedIds.has(activity.id)) continue;
    return getActiveGoalForActivity(activity.id, goals, userId);
  }

  return undefined;
}

export function formatGoalModificationBlockMessage(
  goal: Goal,
  action: GoalModificationBlockAction,
  subject: "activity" | "group" = "activity"
): string {
  const title = getGoalDisplayName(goal);
  const target =
    action === "archive"
      ? "archive this group"
      : action === "delete"
        ? subject === "group"
          ? "delete this group"
          : "delete this habit"
        : "mark this habit as complete";

  return `Complete or cancel the goal "${title}" before you can ${target}.`;
}
