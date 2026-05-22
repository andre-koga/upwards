import type { InboxNotification } from "@/lib/promises/use-notifications";

export function actorDisplayLabel(
  notification: Pick<InboxNotification, "actorDisplayName" | "actorUsername">
): string {
  const displayName = notification.actorDisplayName?.trim();
  if (displayName) return displayName;

  const username = notification.actorUsername?.trim();
  if (username) return username;

  return "Someone";
}

export function formatGoalTargetLabel(goal: {
  target_kind: string | null;
  target_streak: number | null;
  target_end_date: string | null;
}): string | null {
  if (goal.target_kind === "streak_count" && goal.target_streak != null) {
    return `reach a ${goal.target_streak}-day streak`;
  }
  if (goal.target_kind === "streak_until" && goal.target_end_date != null) {
    const d = new Date(goal.target_end_date + "T00:00:00");
    return `keep streak until ${d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }
  return null;
}

export function formatGoalShareMessage(
  notification: Pick<
    InboxNotification,
    | "actorDisplayName"
    | "actorUsername"
    | "goalLabel"
    | "goalTitle"
    | "activityName"
  >
): string {
  const actor = actorDisplayLabel(notification);
  const goalName = notification.goalTitle?.trim();

  if (goalName) {
    return `${actor} shared a goal with you: "${goalName}"`;
  }

  const habit = notification.activityName?.trim();
  if (habit) {
    return `${actor} shared a goal with you for ${habit}`;
  }

  return `${actor} shared a goal with you`;
}

/** @deprecated use formatGoalShareMessage */
export const formatGoalInviteMessage = formatGoalShareMessage;

export function formatGoalCompleteMessage(
  notification: Pick<
    InboxNotification,
    "actorDisplayName" | "actorUsername" | "goalTitle" | "streak"
  >
): string {
  const actor = actorDisplayLabel(notification);
  const goalName = notification.goalTitle?.trim() ?? "their goal";

  if (notification.streak && notification.streak >= 7) {
    return `${actor} logged progress on "${goalName}" — ${notification.streak}-day streak`;
  }

  return `${actor} made progress on "${goalName}"`;
}

export function formatGoalAchievedMessage(
  notification: Pick<
    InboxNotification,
    "actorDisplayName" | "actorUsername" | "goalTitle" | "goalLabel" | "streak"
  >
): string {
  const actor = actorDisplayLabel(notification);
  const goalName = notification.goalTitle?.trim() ?? "their goal";
  const target = notification.goalLabel?.trim();

  if (target && notification.streak && notification.streak > 0) {
    return `${actor} reached "${goalName}" — ${target} (${notification.streak}d streak)!`;
  }
  if (target) {
    return `${actor} reached "${goalName}" — ${target}!`;
  }
  if (notification.streak && notification.streak > 0) {
    return `${actor} reached "${goalName}" with a ${notification.streak}-day streak!`;
  }

  return `${actor} reached "${goalName}"!`;
}
