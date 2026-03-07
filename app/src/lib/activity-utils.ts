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

/**
 * Format milliseconds into a human-readable duration string.
 * e.g. 3661000 → "1h 1m 1s"
 */
export function formatActivityTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
}

/**
 * Format milliseconds into a timer display string (MM:SS or HH:MM:SS).
 * Returns "MM:SS" by default, switches to "HH:MM:SS" when elapsed time >= 1 hour.
 * e.g. 65000 → "01:05", 3661000 → "01:01:01"
 */
export function formatTimerDisplay(elapsedMs: number): string {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

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
    if (!routine || routine === "daily") return "Daily";
    if (routine === "anytime") return "Anytime";
    if (routine === "never") return "Never";

    if (routine.startsWith("weekly:")) {
        const days = routine.split(":")[1].split(",").map(Number);
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return `Weekly: ${days.map((d) => dayNames[d]).join(", ")}`;
    }
    if (routine.startsWith("monthly:")) {
        return `Monthly: Day ${routine.split(":")[1]}`;
    }
    if (routine.startsWith("custom:")) {
        const parts = routine.split(":");
        return `Every ${parts[1]} ${parts[2]}`;
    }

    return routine.charAt(0).toUpperCase() + routine.slice(1);
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

    const routine = activity.routine || "daily";
    if (routine === "anytime") return false;
    if (routine === "never") return true;
    if (routine === "daily") return true;

    if (routine.startsWith("weekly:")) {
        const days = routine.split(":")[1].split(",").map(Number);
        return days.includes(date.getDay());
    }

    if (routine.startsWith("monthly:")) {
        return date.getDate() === parseInt(routine.split(":")[1]);
    }

    if (routine.startsWith("custom:")) {
        const parts = routine.split(":");
        const interval = parseInt(parts[1]);
        const unit = parts[2];
        if (!activity.created_at) return false;

        const creationDate = new Date(activity.created_at);
        creationDate.setHours(0, 0, 0, 0);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        if (unit === "days") {
            const daysDiff = Math.floor(
                (checkDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            return daysDiff >= 0 && daysDiff % interval === 0;
        } else if (unit === "weeks") {
            const daysDiff = Math.floor(
                (checkDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            const weeksDiff = Math.floor(daysDiff / 7);
            return (
                daysDiff >= 0 && weeksDiff % interval === 0 && daysDiff % 7 === 0
            );
        } else if (unit === "months") {
            const monthsDiff =
                (checkDate.getFullYear() - creationDate.getFullYear()) * 12 +
                (checkDate.getMonth() - creationDate.getMonth());
            return (
                monthsDiff >= 0 &&
                monthsDiff % interval === 0 &&
                checkDate.getDate() === creationDate.getDate()
            );
        }
        return false;
    }

    return true;
}
