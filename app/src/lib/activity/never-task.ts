/** Shared helpers for "Never (avoid this)" habits — inverted completion semantics. */

export type NeverTaskActivity = {
  routine?: string | null;
  completion_target?: number | null;
};

export function isNeverRoutine(
  activity: NeverTaskActivity | null | undefined
): boolean {
  return activity?.routine === "never";
}

export function neverTaskTarget(activity: NeverTaskActivity): number {
  return activity.completion_target ?? 1;
}

/** User logged a slip (failed to avoid the habit today). */
export function isNeverTaskSlipped(count: number, target: number = 1): boolean {
  return count >= target;
}

/** User avoided the habit for the day (no slip logged). */
export function isNeverTaskSuccessfulDay(
  count: number,
  target: number = 1
): boolean {
  return count < target;
}

/** Streak-utils sense: "completed" on a never task means the user slipped. */
export function isNeverTaskSlipRecorded(
  activity: NeverTaskActivity,
  count: number
): boolean {
  return isNeverTaskSlipped(count, neverTaskTarget(activity));
}
