import { db, now, newId, toDateStr } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";

export const HIDDEN_GROUP_ACTIVITY_PATTERN = "__group_default_hidden__";

export function isHiddenGroupDefaultActivity(activity: Activity): boolean {
    return activity.pattern === HIDDEN_GROUP_ACTIVITY_PATTERN;
}

export async function getOrCreateHiddenGroupDefaultActivity(
    group: ActivityGroup,
): Promise<Activity> {
    const existing = await db.activities
        .filter(
            (activity) =>
                activity.group_id === group.id &&
                activity.pattern === HIDDEN_GROUP_ACTIVITY_PATTERN &&
                !activity.deleted_at,
        )
        .first();

    const timestamp = now();

    if (existing) {
        await db.activities.update(existing.id, {
            name: group.name,
            color: group.color,
            updated_at: timestamp,
        });

        return {
            ...existing,
            name: group.name,
            color: group.color,
            updated_at: timestamp,
        };
    }

    const hiddenActivity: Activity = {
        id: newId(),
        group_id: group.id,
        name: group.name,
        pattern: HIDDEN_GROUP_ACTIVITY_PATTERN,
        routine: "never",
        completion_target: 1,
        color: group.color,
        is_archived: false,
        order_index: null,
        created_at: timestamp,
        updated_at: timestamp,
        synced_at: null,
        deleted_at: null,
    };

    await db.activities.add(hiddenActivity);
    return hiddenActivity;
}

import { parseRoutine } from "@/lib/activity-formatters";

// Re-export for backward compatibility
export type { ParsedRoutine } from "@/lib/activity-formatters";
export { parseRoutine } from "@/lib/activity-formatters";
export {
    formatActivityTime,
    formatTimerDisplay,
    formatRoutineDisplay,
} from "@/lib/activity-formatters";

/**
 * Stops the current active tracking period for today if it matches
 * the given activityId or belongs to the given groupId.
 */
export async function stopCurrentActivity(options: {
    activityId?: string;
    groupId?: string;
}): Promise<void> {
    try {
        const today = toDateStr(new Date());
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
                dailyEntry.current_activity_id,
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

/**
 * Determines whether an activity should appear for a given date
 * based on its routine configuration.
 */
export function shouldShowActivity(activity: Activity, date: Date): boolean {
    if (isHiddenGroupDefaultActivity(activity)) return false;

    if (activity.created_at) {
        const creationDay = new Date(activity.created_at);
        creationDay.setHours(0, 0, 0, 0);
        const viewDay = new Date(date);
        viewDay.setHours(0, 0, 0, 0);
        if (viewDay < creationDay) return false;
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
                (checkDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            return daysDiff >= 0 && daysDiff % parsed.interval === 0;
        } else if (parsed.unit === "weeks") {
            const daysDiff = Math.floor(
                (checkDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24),
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
