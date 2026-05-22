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

export function formatGoalInviteMessage(
  notification: Pick<
    InboxNotification,
    "actorDisplayName" | "actorUsername" | "goalLabel" | "activityName"
  >
): string {
  const actor = actorDisplayLabel(notification);
  const habit = notification.activityName?.trim();
  const target = notification.goalLabel?.trim();

  if (habit && target) {
    return `${actor} invited you to join their Goal for ${habit} — ${target}`;
  }
  if (habit) {
    return `${actor} invited you to join their Goal for ${habit}`;
  }
  if (target) {
    return `${actor} invited you to join their Goal: ${target}`;
  }
  return `${actor} invited you to join their Goal`;
}

export function formatGoalCompleteMessage(
  notification: Pick<
    InboxNotification,
    "actorDisplayName" | "actorUsername" | "activityName" | "streak"
  >
): string {
  const actor = actorDisplayLabel(notification);
  const habit = notification.activityName?.trim() ?? "a habit";

  if (notification.streak && notification.streak >= 7) {
    return `${actor} hit a ${notification.streak}-day streak on ${habit}`;
  }

  return `${actor} completed ${habit}`;
}
