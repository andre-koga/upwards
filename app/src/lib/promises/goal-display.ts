import { getActivityDisplayName } from "@/lib/activity";
import type { Activity, ActivityGroup, GoalWithMembers } from "@/lib/db/types";

export function formatGoalTargetShort(goal: GoalWithMembers): string {
  if (goal.target_kind === "streak_count" && goal.target_streak != null) {
    return `${goal.target_streak}-day streak`;
  }
  if (goal.target_kind === "streak_until" && goal.target_end_date != null) {
    const d = new Date(goal.target_end_date + "T00:00:00");
    return `Until ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  return "No target";
}

export function getGoalLinkedActivityName(
  goal: GoalWithMembers,
  userId: string | null | undefined,
  activities: Activity[],
  groups: ActivityGroup[]
): string {
  const membership = goal.members.find(
    (m) => m.user_id === userId && m.invite_status === "accepted"
  );
  const activityId = membership?.member_activity_id;

  if (activityId) {
    const activity = activities.find((a) => a.id === activityId);
    if (activity) {
      const group = groups.find((g) => g.id === activity.group_id);
      return getActivityDisplayName(activity, group);
    }
  }

  if (goal.creator_activity_name?.trim()) {
    return goal.creator_activity_name.trim();
  }

  return "Goal";
}

export function memberDisplayLabel(
  displayName: string | null,
  isSelf: boolean
): string {
  if (isSelf) return "You";
  if (displayName?.trim()) {
    return displayName.trim().split(/\s+/)[0] ?? displayName.trim();
  }
  return "Partner";
}
