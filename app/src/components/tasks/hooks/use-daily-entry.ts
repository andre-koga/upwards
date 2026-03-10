import { useState, useCallback } from "react";
import { db, now, newId } from "@/lib/db";
import { getOrCreateDailyEntry as getOrCreateDailyEntryDb } from "@/lib/db/daily-entry";
import type { DailyEntry } from "@/lib/db/types";

export function useDailyEntry(dateString: string) {
    const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null);
    const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [currentActivityId, setCurrentActivityId] = useState<string | null>(
        null,
    );

    const loadDailyEntry = useCallback(async () => {
        try {
            setLoading(true);
            const entry = await db.dailyEntries
                .where("date")
                .equals(dateString)
                .filter((e) => !e.deleted_at)
                .first();
            setDailyEntry(entry || null);
            setTaskCounts((entry?.task_counts as Record<string, number>) || {});
            setCurrentActivityId(entry?.current_activity_id || null);
        } catch (error) {
            console.error("Error loading daily entry:", error);
        } finally {
            setLoading(false);
        }
    }, [dateString]);

    const getOrCreateDailyEntry = useCallback(async (): Promise<DailyEntry> => {
        const entry = await getOrCreateDailyEntryDb(dateString);
        setDailyEntry(entry);
        return entry;
    }, [dateString]);

    const incrementTask = useCallback(
        async (activityId: string, target: number) => {
            let newCounts: Record<string, number> = {};
            setTaskCounts((prev) => {
                const current = prev[activityId] || 0;
                const next = current >= target ? 0 : current + 1;
                newCounts = { ...prev };
                if (next === 0) {
                    delete newCounts[activityId];
                } else {
                    newCounts[activityId] = next;
                }
                return newCounts;
            });

            try {
                const entry = await db.dailyEntries
                    .where("date")
                    .equals(dateString)
                    .filter((e) => !e.deleted_at)
                    .first();
                if (entry) {
                    await db.dailyEntries.update(entry.id, {
                        task_counts: newCounts,
                        updated_at: now(),
                    });
                } else {
                    const n = now();
                    const newDbEntry: DailyEntry = {
                        id: newId(),
                        date: dateString,
                        task_counts: newCounts,
                        current_activity_id: null,
                        created_at: n,
                        updated_at: n,
                        synced_at: null,
                        deleted_at: null,
                    };
                    await db.dailyEntries.add(newDbEntry);
                }
            } catch (err) {
                console.error("Error persisting task count:", err);
                loadDailyEntry();
            }
        },
        [dateString, loadDailyEntry],
    );

    return {
        dailyEntry,
        taskCounts,
        loading,
        currentActivityId,
        setCurrentActivityId,
        loadDailyEntry,
        getOrCreateDailyEntry,
        incrementTask,
    };
}
