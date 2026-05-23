import type { Activity } from "@/lib/db/types";
import {
  isDeletedAsOfActivity,
  type TemporalVisibilityContext,
} from "@/lib/activity/utils";

export type DailyTaskRetiredKind = "deleted" | "completed";

export interface DailyTaskInteractionState {
  /** Muted timer/play/manual-time display (checkbox uses canEditCounts). */
  isReadOnly: boolean;
  /** When set, name tap shows retired info. */
  retiredKind: DailyTaskRetiredKind | null;
  /** Name opens retired info dialog when retiredKind is set. */
  canClickName: boolean;
  /** Checkbox / count controls. */
  canEditCounts: boolean;
  /** Play, stop, and manual time entry on the activity pill. */
  canUseTimer: boolean;
}

/**
 * Single source of truth for For Today row interactivity on the daily tasks list.
 * Once an activity is deleted (row `deleted_at`), every historical row is
 * read-only. Completed habits keep the interactive pill styling on editable dates.
 */
export function getDailyTaskInteractionState(
  activity: Activity,
  temporal: TemporalVisibilityContext,
  isEditableDate: boolean
): DailyTaskInteractionState {
  // Row flag: activity was deleted globally — lock all past For Today rows even
  // on calendar days before the deletion (e.g. delete today, view yesterday).
  const isDeletedRetired =
    !!activity.deleted_at || isDeletedAsOfActivity(activity, temporal);
  const isCompletedRetired =
    !!activity.completed_at && !activity.deleted_at;

  if (isDeletedRetired) {
    return {
      isReadOnly: true,
      retiredKind: "deleted",
      canClickName: true,
      canEditCounts: false,
      canUseTimer: false,
    };
  }

  if (isCompletedRetired) {
    return {
      isReadOnly: false,
      retiredKind: "completed",
      canClickName: true,
      canEditCounts: isEditableDate,
      canUseTimer: isEditableDate,
    };
  }

  if (!isEditableDate) {
    return {
      isReadOnly: true,
      retiredKind: null,
      canClickName: true,
      canEditCounts: false,
      canUseTimer: false,
    };
  }

  return {
    isReadOnly: false,
    retiredKind: null,
    canClickName: true,
    canEditCounts: true,
    canUseTimer: true,
  };
}
