import type { GoalMemberDayStatus } from "@/lib/promises/use-goal-member-status";
import { computeGoalProgress } from "@/lib/promises/use-goal-progress";
import type { GoalWithMembers } from "@/lib/db/types";

/** Daily accountability status for a goal member on the viewed calendar day. */
export type GoalMemberDayCompletionStatus =
  | "completed"
  | "pending"
  | "failed"
  | "witness"
  | "paused"
  | "break";

export type EnrichedGoalMemberStatus = GoalMemberDayStatus & {
  dayStatus: GoalMemberDayCompletionStatus;
  progressPercent: number | null;
  memberActivityId: string | null;
  currentStreak: number;
};

export function goalMemberStatusColor(
  status: GoalMemberDayCompletionStatus
): string {
  switch (status) {
    case "completed":
      return "text-green-600 dark:text-green-400";
    case "pending":
      return "text-blue-600 dark:text-blue-400";
    case "failed":
      return "text-destructive";
    case "witness":
      return "text-muted-foreground";
    case "paused":
    case "break":
      return "text-amber-500";
  }
}

/**
 * Resolve whether a member completed, is still in progress, or failed on the viewed day.
 *
 * - **completed**: daily habit target met (local task counts for you, progress event for others)
 * - **pending**: editable/viewing today, target not yet met
 * - **failed**: past day closed without completion (would break streak if not break/paused)
 * - **witness**: joined without linking a habit
 * - **paused** / **break**: your local day is paused or marked break (self only)
 */
export function resolveGoalMemberDayStatus(params: {
  hasLinkedHabit: boolean;
  completedRemote: boolean;
  isSelf: boolean;
  isEditableDate: boolean;
  localCompleted?: boolean;
  isPaused?: boolean;
  isBreakDay?: boolean;
}): GoalMemberDayCompletionStatus {
  const {
    hasLinkedHabit,
    completedRemote,
    isSelf,
    isEditableDate,
    localCompleted = false,
    isPaused = false,
    isBreakDay = false,
  } = params;

  if (!hasLinkedHabit) return "witness";

  // Self: local task counts for the viewed day. Partners: remote progress events.
  const completed = isSelf ? localCompleted : completedRemote;
  if (completed) return "completed";

  if (isSelf && isPaused) return "paused";
  if (isSelf && isBreakDay) return "break";

  if (isEditableDate) return "pending";

  return "failed";
}

export function isLocalActivityComplete(
  activityId: string | null,
  taskCounts: Record<string, number>,
  activities: { id: string; completion_target?: number | null }[],
  pausedTaskIds: string[]
): boolean {
  if (!activityId || pausedTaskIds.includes(activityId)) return false;
  const activity = activities.find((a) => a.id === activityId);
  if (!activity) return false;
  const target = activity.completion_target ?? 1;
  return (taskCounts[activityId] ?? 0) >= target;
}

export function enrichGoalMemberStatuses(params: {
  goal: GoalWithMembers;
  members: GoalMemberDayStatus[];
  activityStreaks: Record<string, number>;
  taskCounts: Record<string, number>;
  pausedTaskIds: string[];
  isBreakDay: boolean;
  isEditableDate: boolean;
  viewDate: Date;
  activities: { id: string; completion_target?: number | null }[];
  memberActivityIds: Map<string, string | null>;
}): EnrichedGoalMemberStatus[] {
  const {
    goal,
    members,
    activityStreaks,
    taskCounts,
    pausedTaskIds,
    isBreakDay,
    isEditableDate,
    viewDate,
    activities,
    memberActivityIds,
  } = params;

  return members.map((member) => {
    const memberActivityId = memberActivityIds.get(member.userId) ?? null;
    const localCompleted =
      member.isSelf &&
      isLocalActivityComplete(
        memberActivityId,
        taskCounts,
        activities,
        pausedTaskIds
      );

    const dayStatus = resolveGoalMemberDayStatus({
      hasLinkedHabit: member.hasLinkedHabit,
      completedRemote: member.isSelf ? false : member.completed,
      isSelf: member.isSelf,
      isEditableDate,
      localCompleted: member.isSelf ? localCompleted : false,
      isPaused: member.isSelf && !!memberActivityId && pausedTaskIds.includes(memberActivityId),
      isBreakDay: member.isSelf && isBreakDay,
    });

    const currentStreak =
      member.isSelf && memberActivityId
        ? (activityStreaks[memberActivityId] ?? 0)
        : (member.remoteStreak ?? 0);

    const { progressPercent } = member.hasLinkedHabit
      ? computeGoalProgress(goal, currentStreak, viewDate)
      : { progressPercent: null };

    return {
      ...member,
      completed: member.isSelf ? localCompleted : member.completed,
      dayStatus,
      progressPercent,
      memberActivityId,
      currentStreak,
    };
  });
}
