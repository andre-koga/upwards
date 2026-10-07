import type { Activity } from "@/lib/db/types";

/**
 * Whether an activity has a timer. Check-only activities (medication, "made my
 * bed") have none: no start/stop control, no sessions, and they never appear
 * in session pickers (product-scope.md §2.1). Rows from before the cutover
 * default to true.
 */
export function activityTracksTime(
  activity: Pick<Activity, "tracks_time"> | null | undefined
): boolean {
  return activity?.tracks_time !== false;
}

/**
 * Avoid habits ("never") log slips and are never timed. Time-only activities
 * ("anytime") exist to be timed, so they cannot turn the timer off. Everything
 * else may choose.
 */
export function trackTimeRule(routine: string | null | undefined): {
  /** The value the activity must have, or null when the user may choose. */
  forced: boolean | null;
  /** Whether the switch should be offered at all. */
  canChoose: boolean;
} {
  if (routine === "never") return { forced: false, canChoose: false };
  if (routine === "anytime") return { forced: true, canChoose: false };
  return { forced: null, canChoose: true };
}

/** The value to save: the rule wins over whatever the switch says. */
export function resolveTracksTime(
  routine: string | null | undefined,
  requested: boolean
): boolean {
  const { forced } = trackTimeRule(routine);
  return forced ?? requested;
}
