/**
 * SRP: Loads and updates one memo session's editable details (start/end time, date, delete).
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { db, now, newId } from "@/lib/db";
import type { MemoPeriod, DailyEntry, OneTimeTask } from "@/lib/db/types";
import {
  fromDateString,
  toDateString,
  formatTimeInput,
  combineDateAndTime,
  startOfDay,
} from "@/lib/date-utils";
import { ERROR_MESSAGES } from "@/lib/error-utils";

export interface MemoSessionDetailsData {
  memo: OneTimeTask;
  period: MemoPeriod;
  entry: DailyEntry | undefined;
}

interface UseMemoSessionDetailsOptions {
  sessionId?: string;
  onDone?: () => void;
  onUpdated?: () => void;
}

export function useMemoSessionDetails(
  options: UseMemoSessionDetailsOptions = {}
) {
  const { sessionId, onDone, onUpdated } = options;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<MemoSessionDetailsData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const onDoneRef = useRef(onDone);
  const onUpdatedRef = useRef(onUpdated);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    onUpdatedRef.current = onUpdated;
  }, [onUpdated]);

  const finish = useCallback(() => {
    onDoneRef.current?.();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setDetails(null);

      if (!sessionId) {
        setLoading(false);
        return;
      }

      const period = await db.memoPeriods.get(sessionId);
      if (!period || period.deleted_at) {
        finish();
        return;
      }

      const memo = await db.oneTimeTasks.get(period.one_time_task_id);
      if (!memo || memo.deleted_at) {
        finish();
        return;
      }

      const entry = await db.dailyEntries.get(period.daily_entry_id);

      const initialDate = entry?.date
        ? fromDateString(entry.date)
        : new Date(period.start_time);

      setDetails({ memo, period, entry });
      setSelectedDate(initialDate);
      setStartTime(formatTimeInput(period.start_time));
      setEndTime(formatTimeInput(period.end_time));
      setLoading(false);
    };

    void load();
  }, [finish, sessionId]);

  const handleDelete = useCallback(async () => {
    if (!sessionId) return;
    try {
      await db.memoPeriods.update(sessionId, {
        deleted_at: now(),
        updated_at: now(),
      });
      onUpdatedRef.current?.();
      finish();
    } catch (deleteError) {
      console.error("Error deleting memo session:", deleteError);
    }
  }, [finish, sessionId]);

  const handleSave = useCallback(async () => {
    if (!sessionId || !details) return;

    if (!startTime) {
      setError("Please set a start time.");
      return;
    }

    const nextStartIso = combineDateAndTime(selectedDate, startTime);
    const isRunning = details.period.end_time === null;
    const nextEndIso = isRunning
      ? null
      : endTime
        ? combineDateAndTime(selectedDate, endTime)
        : null;

    if (
      nextEndIso &&
      new Date(nextEndIso).getTime() < new Date(nextStartIso).getTime()
    ) {
      setError("End time cannot be before start time.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const selectedDateString = toDateString(selectedDate);
      const existingEntry = await db.dailyEntries
        .where("date")
        .equals(selectedDateString)
        .filter((e) => !e.deleted_at)
        .first();

      let dailyEntryId = existingEntry?.id;
      if (!dailyEntryId) {
        const timestamp = now();
        const created: DailyEntry = {
          id: newId(),
          date: selectedDateString,
          task_counts: {},
          paused_task_ids: [],
          is_break_day: false,
          current_activity_id: null,
          current_memo_id: null,
          created_at: timestamp,
          updated_at: timestamp,
          synced_at: null,
          deleted_at: null,
        };
        await db.dailyEntries.add(created);
        dailyEntryId = created.id;
      }

      const n = now();
      await db.memoPeriods.update(sessionId, {
        daily_entry_id: dailyEntryId,
        start_time: nextStartIso,
        end_time: nextEndIso,
        updated_at: n,
      });

      if (isRunning) {
        await db.dailyEntries.update(dailyEntryId, {
          current_memo_id: details.period.one_time_task_id,
          updated_at: n,
        });
      }

      onUpdatedRef.current?.();
      finish();
    } catch (saveError) {
      console.error("Error saving memo session:", saveError);
      setError(ERROR_MESSAGES.SAVE_SESSION);
    } finally {
      setSaving(false);
    }
  }, [sessionId, details, startTime, endTime, selectedDate, finish]);

  const isRunningSession =
    details?.period != null && details.period.end_time === null;

  return {
    loading,
    saving,
    error,
    details,
    isRunningSession,
    selectedDate,
    setSelectedDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    handleDelete,
    handleSave,
    today: useMemo(() => startOfDay(new Date()), []),
  };
}
