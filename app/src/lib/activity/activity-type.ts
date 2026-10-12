import { resolveTracksTime } from "./tracks-time";

/**
 * The one question the activity form asks (product-scope.md §2.1). The stored
 * fields (routine, target, tracks_time) do not change; the type maps onto them
 * and `normalizeActivityByType` guarantees no meaningless combination is saved.
 *
 * - habit: scheduled, may be a counter, the timer is optional
 * - avoid: routine "never", logs slips, never timed
 * - time-only: routine "anytime", no schedule or streak, always timed
 */
export type ActivityType = "habit" | "avoid" | "time-only";

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  "habit",
  "avoid",
  "time-only",
];

export const DEFAULT_HABIT_ROUTINE = "daily";

export function activityTypeOfRoutine(
  routine: string | null | undefined
): ActivityType {
  if (routine === "never") return "avoid";
  if (routine === "anytime") return "time-only";
  return "habit";
}

/** A routine a habit may keep; "never" and "anytime" belong to other types. */
export function habitRoutineOrDefault(routine: string | null | undefined) {
  return routine && routine !== "never" && routine !== "anytime"
    ? routine
    : DEFAULT_HABIT_ROUTINE;
}

export interface TypedActivityFields {
  routine: string;
  completion_target: number;
  tracks_time: boolean;
}

/**
 * The fields to save for a chosen type.
 *
 * `habitRoutine` is the schedule the form built; it only applies to habits.
 * `existingTarget` keeps an avoid habit's recorded target when it is edited
 * (the form never shows a target for it).
 */
export function normalizeActivityByType(input: {
  type: ActivityType;
  habitRoutine: string;
  target: number | string;
  tracksTime: boolean;
  existingTarget?: number | null;
}): TypedActivityFields {
  switch (input.type) {
    case "avoid":
      return {
        routine: "never",
        completion_target: Math.max(1, input.existingTarget ?? 1),
        tracks_time: false,
      };
    case "time-only":
      return {
        routine: "anytime",
        completion_target: Math.max(1, input.existingTarget ?? 1),
        tracks_time: true,
      };
    case "habit": {
      const routine = habitRoutineOrDefault(input.habitRoutine);
      return {
        routine,
        completion_target: Math.max(1, parseInt(String(input.target)) || 1),
        tracks_time: resolveTracksTime(routine, input.tracksTime),
      };
    }
  }
}
