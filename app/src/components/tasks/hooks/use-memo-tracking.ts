import { useState, useCallback } from "react";
import { db, now, newId } from "@/lib/db";
import type { MemoPeriod, DailyEntry } from "@/lib/db/types";
import { closeOpenMemoPeriods } from "@/lib/memo-periods";
import { closeOpenPeriods } from "@/lib/activity-periods";

export function useMemoTracking(
  dateString: string,
  currentMemoId: string | null,
  setCurrentMemoId: (id: string | null) => void,
  getOrCreateDailyEntry: () => Promise<DailyEntry>
) {
  const [memoPeriods, setMemoPeriods] = useState<MemoPeriod[]>([]);

  const loadMemoPeriods = useCallback(async () => {
    try {
      const entry = await db.dailyEntries
        .where("date")
        .equals(dateString)
        .filter((e) => !e.deleted_at)
        .first();

      if (!entry) {
        setMemoPeriods([]);
        return;
      }

      const periods = await db.memoPeriods
        .where("daily_entry_id")
        .equals(entry.id)
        .filter((p) => !p.deleted_at)
        .sortBy("start_time");

      setMemoPeriods(periods);
    } catch (error) {
      console.error("Error loading memo periods:", error);
    }
  }, [dateString]);

  const calculateMemoTime = useCallback(
    (memoId: string): number => {
      const periods = memoPeriods.filter((p) => p.one_time_task_id === memoId);
      return periods.reduce((total, period) => {
        const start = new Date(period.start_time).getTime();
        const end = period.end_time
          ? new Date(period.end_time).getTime()
          : Date.now();
        return total + (end - start);
      }, 0);
    },
    [memoPeriods]
  );

  const handleStartMemo = useCallback(
    async (memoId: string) => {
      if (currentMemoId === memoId) return;
      try {
        const n = now();
        const entry = await getOrCreateDailyEntry();

        await closeOpenPeriods(entry.id);
        await closeOpenMemoPeriods(entry.id);

        const newPeriod: MemoPeriod = {
          id: newId(),
          daily_entry_id: entry.id,
          one_time_task_id: memoId,
          start_time: n,
          end_time: null,
          created_at: n,
          updated_at: n,
          synced_at: null,
          deleted_at: null,
        };
        await db.memoPeriods.add(newPeriod);
        await db.dailyEntries.update(entry.id, {
          current_activity_id: null,
          current_memo_id: memoId,
          updated_at: n,
        });

        setCurrentMemoId(memoId);
        await loadMemoPeriods();
      } catch (error) {
        console.error("Error starting memo timer:", error);
      }
    },
    [currentMemoId, getOrCreateDailyEntry, setCurrentMemoId, loadMemoPeriods]
  );

  const handleStopMemo = useCallback(async () => {
    if (!currentMemoId) return;
    try {
      const n = now();
      const entry = await getOrCreateDailyEntry();

      await closeOpenMemoPeriods(entry.id);

      await db.dailyEntries.update(entry.id, {
        current_memo_id: null,
        updated_at: n,
      });

      setCurrentMemoId(null);
      await loadMemoPeriods();
    } catch (error) {
      console.error("Error stopping memo timer:", error);
    }
  }, [currentMemoId, getOrCreateDailyEntry, setCurrentMemoId, loadMemoPeriods]);

  return {
    memoPeriods,
    loadMemoPeriods,
    calculateMemoTime,
    handleStartMemo,
    handleStopMemo,
  };
}
