import type { Activity, GoalWithMembers } from "@/lib/db/types";
import { getGoalLinkedActivityId } from "@/lib/promises/use-goal-progress";

function getGoalTitleForMessage(goal: GoalWithMembers): string {
  const titledGoal = goal as GoalWithMembers & { title?: string | null };
  if (titledGoal.title?.trim()) return titledGoal.title.trim();
  if (goal.creator_activity_name?.trim()) return goal.creator_activity_name.trim();
  return "Goal";
}

export type GoalModificationBlockAction = "complete" | "delete" | "archive";

/** Activity ids already linked to one of the user's active goals. */
export function getActivityIdsWithActiveGoals(
  goals: GoalWithMembers[],
  userId: string | null | undefined
): Set<string> {
  const ids = new Set<string>();
  if (!userId) return ids;

  for (const goal of goals) {
    if (goal.status !== "active") continue;

    const isAcceptedMember = goal.members.some(
      (member) =>
        member.user_id === userId && member.invite_status === "accepted"
    );
    if (!isAcceptedMember) continue;

    const activityId = getGoalLinkedActivityId(goal, userId);
    if (activityId) ids.add(activityId);
  }

  return ids;
}

export function activityHasActiveGoal(
  activityId: string,
  goals: GoalWithMembers[],
  userId: string | null | undefined
): boolean {
  return getActivityIdsWithActiveGoals(goals, userId).has(activityId);
}

export function filterActivitiesWithoutActiveGoals(
  activities: { id: string }[],
  goals: GoalWithMembers[],
  userId: string | null | undefined
): { id: string }[] {
  const usedIds = getActivityIdsWithActiveGoals(goals, userId);
  return activities.filter((activity) => !usedIds.has(activity.id));
}

export function getActiveGoalForActivity(
  activityId: string,
  goals: GoalWithMembers[],
  userId: string | null | undefined
): GoalWithMembers | undefined {
  if (!userId) return undefined;

  for (const goal of goals) {
    if (goal.status !== "active") continue;

    const isAcceptedMember = goal.members.some(
      (member) =>
        member.user_id === userId && member.invite_status === "accepted"
    );
    if (!isAcceptedMember) continue;

    if (getGoalLinkedActivityId(goal, userId) === activityId) {
      return goal;
    }
  }

  return undefined;
}

export function getActiveGoalBlockingGroup(
  groupId: string,
  activities: Activity[],
  goals: GoalWithMembers[],
  userId: string | null | undefined
): GoalWithMembers | undefined {
  const linkedIds = getActivityIdsWithActiveGoals(goals, userId);
  if (linkedIds.size === 0) return undefined;

  for (const activity of activities) {
    if (activity.group_id !== groupId || !linkedIds.has(activity.id)) continue;
    return getActiveGoalForActivity(activity.id, goals, userId);
  }

  return undefined;
}

export function formatGoalModificationBlockMessage(
  goal: GoalWithMembers,
  action: GoalModificationBlockAction,
  subject: "activity" | "group" = "activity"
): string {
  const title = getGoalTitleForMessage(goal);
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
