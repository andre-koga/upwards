import i18n from "@/lib/i18n";
import { db, now } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  ActivityStatusEvent,
  GroupStatusEvent,
} from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { toDateString } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { isActivityStatusAsOf, isGroupStatusAsOf } from "./status-events";
import {
  isHiddenGroupDefaultActivity,
  getOrCreateHiddenGroupDefaultActivity,
} from "./hidden-default";

export { isHiddenGroupDefaultActivity, getOrCreateHiddenGroupDefaultActivity };

type ParsedRoutine =
  | { type: "daily" }
  | { type: "anytime" }
  | { type: "never" }
  | { type: "weekly"; days: number[] }
  | { type: "monthly"; day: number }
  | { type: "custom"; interval: number; unit: "days" | "weeks" | "months" }
  | { type: "unknown"; raw: string };

interface DurationParts {
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function decomposeDurationMs(milliseconds: number): DurationParts {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalSeconds, hours, minutes, seconds };
}

/**
 * Parse a routine string into a structured format.
 */
export function parseRoutine(routine: string | null): ParsedRoutine {
  if (!routine || routine === "daily") return { type: "daily" };
  if (routine === "anytime") return { type: "anytime" };
  if (routine === "never") return { type: "never" };

  if (routine.startsWith("weekly:")) {
    const daysStr = routine.split(":")[1];
    const days = daysStr ? daysStr.split(",").map(Number) : [];
    return { type: "weekly", days };
  }
  if (routine.startsWith("monthly:")) {
    const day = parseInt(routine.split(":")[1]) || 1;
    return { type: "monthly", day };
  }
  if (routine.startsWith("custom:")) {
    const parts = routine.split(":");
    const interval = parseInt(parts[1]) || 1;
    const unit = (parts[2] as "days" | "weeks" | "months") || "days";
    return { type: "custom", interval, unit };
  }

  return { type: "unknown", raw: routine };
}

/**
 * Format milliseconds into a timer display string (MM:SS or HH:MM:SS).
 * Returns "MM:SS" by default, switches to "HH:MM:SS" when elapsed time >= 1 hour.
 * e.g. 65000 → "01:05", 3661000 → "01:01:01"
 */
export function formatTimerDisplay(elapsedMs: number): string {
  const { hours, minutes, seconds } = decomposeDurationMs(elapsedMs);
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Convert a routine string to a human-readable label.
 * e.g. "weekly:1,3,5" → "Weekly: Mon, Wed, Fri"
 */
export function formatRoutineDisplay(routine: string | null): string {
  const parsed = parseRoutine(routine);
  switch (parsed.type) {
    case "daily":
      return i18n.t("projects:routine.display.daily");
    case "anytime":
      return i18n.t("projects:routine.display.anytime");
    case "never":
      return i18n.t("projects:routine.display.never");
    case "weekly": {
      const days = parsed.days
        .map((d) => i18n.t(`projects:routine.display.weekdayShort.${d}`))
        .join(", ");
      return i18n.t("projects:routine.display.weekly", { days });
    }
    case "monthly":
      return i18n.t("projects:routine.display.monthly", { day: parsed.day });
    case "custom":
      return i18n.t("projects:routine.display.every", {
        interval: parsed.interval,
        unit: i18n.t(`projects:routine.${parsed.unit}`),
      });
    case "unknown":
      return parsed.raw.charAt(0).toUpperCase() + parsed.raw.slice(1);
  }
}

/** Display name for an activity; uses group name when activity.name is null (group-default). */
export function getActivityDisplayName(
  activity: Activity | null | undefined,
  group: ActivityGroup | null | undefined
): string {
  return activity?.name ?? group?.name ?? "Unknown";
}

export function getGroup(
  groups: ActivityGroup[],
  groupId: string
): ActivityGroup | undefined {
  return groups.find((g) => g.id === groupId);
}

export function getGroupName(
  groups: ActivityGroup[],
  groupId: string,
  fallback = "Unknown"
): string {
  return getGroup(groups, groupId)?.name ?? fallback;
}

export function getGroupColor(
  groups: ActivityGroup[],
  groupId: string,
  fallback = DEFAULT_GROUP_COLOR
): string {
  return getGroup(groups, groupId)?.color ?? fallback;
}

/** An activity is archived when its own flag is set, independent of the group. */
export function isArchivedViaGroup(
  group: ActivityGroup | undefined | null
): boolean {
  return !!group?.is_archived && !group?.deleted_at;
}

export interface TemporalVisibilityContext {
  viewDate: Date;
  activityEventsById: Map<string, ActivityStatusEvent[]>;
  groupEventsById: Map<string, GroupStatusEvent[]>;
}

export function isArchivedViaGroupAsOf(
  group: ActivityGroup | undefined | null,
  ctx: TemporalVisibilityContext
): boolean {
  if (!group) return false;
  const events = ctx.groupEventsById.get(group.id) ?? [];
  return isGroupStatusAsOf(events, "archived", ctx.viewDate, group);
}

export function isDeletedAsOfActivity(
  activity: Activity,
  ctx: TemporalVisibilityContext
): boolean {
  const events = ctx.activityEventsById.get(activity.id) ?? [];
  return isActivityStatusAsOf(events, "deleted", ctx.viewDate, activity);
}

export function isDeletedAsOfGroup(
  group: ActivityGroup | undefined | null,
  ctx: TemporalVisibilityContext
): boolean {
  if (!group) return false;
  const events = ctx.groupEventsById.get(group.id) ?? [];
  return isGroupStatusAsOf(events, "deleted", ctx.viewDate, group);
}

export function isActivityArchived(activity: Activity): boolean {
  return activity.is_archived === true || !!activity.completed_at;
}

export function isArchivedAsOf(
  activity: Activity,
  ctx: TemporalVisibilityContext
): boolean {
  const events = ctx.activityEventsById.get(activity.id) ?? [];
  return isActivityStatusAsOf(events, "archived", ctx.viewDate, activity);
}

/** @deprecated Use `isArchivedAsOf`. */
export function isCompletedAsOf(
  activity: Activity,
  ctx: TemporalVisibilityContext
): boolean {
  return isArchivedAsOf(activity, ctx);
}

export function isActiveActivity(a: Activity): boolean {
  return !isActivityArchived(a) && !a.deleted_at;
}

export function isActiveGroup(g: ActivityGroup): boolean {
  return !g.is_archived && !g.deleted_at;
}

export function buildGroupById(
  groups: ActivityGroup[]
): Map<string, ActivityGroup> {
  return new Map(groups.map((g) => [g.id, g]));
}

/**
 * Filter activities to those that are active (not completed, not deleted) AND
 * whose parent group is also active (not archived, not deleted).
 */
export function filterActiveActivities(
  activities: Activity[],
  groupById: Map<string, ActivityGroup>
): Activity[] {
  return activities.filter((a) => {
    if (isActivityArchived(a) || a.deleted_at) return false;
    const group = groupById.get(a.group_id);
    return !isArchivedViaGroup(group);
  });
}

export function isScheduledRoutine(routine: string): boolean {
  return routine !== "anytime" && routine !== "never";
}

/**
 * Sort activities by order_index, then by created_at.
 */
export function sortActivitiesByOrder(activities: Activity[]): Activity[] {
  return [...activities].sort((left, right) => {
    const leftOrder =
      typeof left.order_index === "number"
        ? left.order_index
        : Number.POSITIVE_INFINITY;
    const rightOrder =
      typeof right.order_index === "number"
        ? right.order_index
        : Number.POSITIVE_INFINITY;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return (
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    );
  });
}

/**
 * Stops the current active tracking period for today if it matches
 * the given activityId or belongs to the given groupId.
 */
export async function stopCurrentActivity(options: {
  activityId?: string;
  groupId?: string;
}): Promise<void> {
  try {
    const today = getEffectiveToday();
    const dailyEntry = await db.dailyEntries
      .where("date")
      .equals(today)
      .filter((e) => !e.deleted_at)
      .first();
    if (!dailyEntry || !dailyEntry.current_activity_id) return;

    let shouldStop = false;
    if (options.activityId) {
      shouldStop = dailyEntry.current_activity_id === options.activityId;
    } else if (options.groupId) {
      const currentActivity = await db.activities.get(
        dailyEntry.current_activity_id
      );
      shouldStop = currentActivity?.group_id === options.groupId;
    }

    if (!shouldStop) return;

    const n = now();
    const currentPeriod = await db.activityPeriods
      .where("daily_entry_id")
      .equals(dailyEntry.id)
      .filter((p) => !p.end_time && !p.deleted_at)
      .first();

    if (currentPeriod) {
      await db.activityPeriods.update(currentPeriod.id, {
        end_time: n,
        updated_at: n,
      });
    }
    await db.dailyEntries.update(dailyEntry.id, {
      current_activity_id: null,
      updated_at: n,
    });
  } catch (error) {
    console.error("Error stopping current activity:", error);
  }
}

/** Whether the activity's routine expects completion on the given calendar day. */
export function isRoutineDueOnDate(
  activity: { routine?: string | null; created_at?: string | null },
  date: Date
): boolean {
  if (activity.created_at) {
    // Use effective day for the creation timestamp so activities created
    // after midnight (before the reset) belong to the previous logical day.
    const effectiveCreationDay = getEffectiveToday(
      new Date(activity.created_at)
    );
    const viewDay = toDateString(date);
    if (viewDay < effectiveCreationDay) return false;
  }

  const parsed = parseRoutine(activity.routine || "daily");
  if (parsed.type === "anytime") return false;
  if (parsed.type === "never") return true;
  if (parsed.type === "daily") return true;

  if (parsed.type === "weekly") {
    return parsed.days.includes(date.getDay());
  }

  if (parsed.type === "monthly") {
    return date.getDate() === parsed.day;
  }

  if (parsed.type === "custom") {
    if (!activity.created_at) return false;

    const creationDate = new Date(activity.created_at);
    creationDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (parsed.unit === "days") {
      const daysDiff = Math.floor(
        (checkDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysDiff >= 0 && daysDiff % parsed.interval === 0;
    } else if (parsed.unit === "weeks") {
      const daysDiff = Math.floor(
        (checkDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const weeksDiff = Math.floor(daysDiff / 7);
      return (
        daysDiff >= 0 && weeksDiff % parsed.interval === 0 && daysDiff % 7 === 0
      );
    } else if (parsed.unit === "months") {
      const monthsDiff =
        (checkDate.getFullYear() - creationDate.getFullYear()) * 12 +
        (checkDate.getMonth() - creationDate.getMonth());
      return (
        monthsDiff >= 0 &&
        monthsDiff % parsed.interval === 0 &&
        checkDate.getDate() === creationDate.getDate()
      );
    }
    return false;
  }

  return true;
}

/**
 * Determines whether an activity should appear on For Today for a viewed date.
 * Lifecycle uses status history; schedule/rules use the current activity row.
 */
export function shouldShowActivity(
  activity: Activity,
  date: Date,
  group: ActivityGroup | undefined | null,
  temporal: TemporalVisibilityContext
): boolean {
  if (isHiddenGroupDefaultActivity(activity)) return false;

  if (isArchivedAsOf(activity, temporal)) return false;
  if (isDeletedAsOfActivity(activity, temporal)) return false;
  if (isArchivedViaGroupAsOf(group, temporal)) return false;
  if (isDeletedAsOfGroup(group, temporal)) return false;

  return isRoutineDueOnDate(activity, date);
}
