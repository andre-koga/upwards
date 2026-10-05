import type { Activity } from "@/lib/db/types";
import {
  isActivityArchived,
  isDeletedAsOfActivity,
  type TemporalVisibilityContext,
} from "@/lib/activity/utils";

export type DailyTaskRetiredKind = "deleted" | "archived";

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
 * read-only. Every day is otherwise editable; older days ask for confirmation
 * when saving, not here.
 */
export function getDailyTaskInteractionState(
  activity: Activity,
  temporal: TemporalVisibilityContext
): DailyTaskInteractionState {
  // Row flag: activity was deleted globally — lock all past For Today rows even
  // on calendar days before the deletion (e.g. delete today, view yesterday).
  const isDeletedRetired =
    !!activity.deleted_at || isDeletedAsOfActivity(activity, temporal);
  const isArchivedRetired =
    isActivityArchived(activity) && !activity.deleted_at;

  if (isDeletedRetired) {
    return {
      isReadOnly: true,
      retiredKind: "deleted",
      canClickName: true,
      canEditCounts: false,
      canUseTimer: false,
    };
  }

  if (isArchivedRetired) {
    return {
      isReadOnly: false,
      retiredKind: "archived",
      canClickName: true,
      canEditCounts: true,
      canUseTimer: true,
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
