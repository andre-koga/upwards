import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { db, now } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  DailyEntry,
} from "@/lib/db/types";
import {
  getOrCreateHiddenGroupDefaultActivity,
  isHiddenGroupDefaultActivity,
} from "@/lib/activity";
import {
  toDateString,
  formatTimeInput,
  combineDateAndTime,
  shiftDate,
  timeToSeconds,
  startOfDay,
  fromDateString,
} from "@/lib/time-utils";
import { getOrCreateDailyEntry } from "@/lib/db/daily-entry";
import { ERROR_MESSAGES } from "@/lib/error-utils";
import { getEffectiveToday, getDayResetMinutes } from "@/lib/session/day-reset";

const NONE_ACTIVITY_VALUE = "__none__";

interface SessionDetailsData {
  group: ActivityGroup;
  activity: Activity | null;
  period: ActivityPeriod;
  entry: DailyEntry | undefined;
}

interface UseSessionDetailsOptions {
  groupId?: string;
  sessionId?: string;
  onDone?: () => void;
  onUpdated?: () => void;
}

export function useSessionDetails(options: UseSessionDetailsOptions = {}) {
  const {
    groupId: groupIdOption,
    sessionId: sessionIdOption,
    onDone,
    onUpdated,
  } = options;
  const groupId = groupIdOption;
  const sessionId = sessionIdOption;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<SessionDetailsData | null>(null);
  const [groupActivities, setGroupActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(() => fromDateString(getEffectiveToday()));
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

      if (!groupId || !sessionId) {
        finish();
        return;
      }

      const [group, period] = await Promise.all([
        db.activityGroups.get(groupId),
        db.activityPeriods.get(sessionId),
      ]);

      if (!group || group.deleted_at || !period || period.deleted_at) {
        finish();
        return;
      }

      const activity = await db.activities.get(period.activity_id);
      if (activity && !activity.deleted_at && activity.group_id !== group.id) {
        finish();
        return;
      }

      const [entry, activities] = await Promise.all([
        db.dailyEntries.get(period.daily_entry_id),
        db.activities
          .filter((item) => item.group_id === group.id && !item.deleted_at)
          .sortBy("created_at"),
      ]);

      // Use the period's actual start_time to initialise the date picker so
      // cross-boundary sessions (start before reset, end after) open on the
      // correct calendar day, not the daily-entry date.
      const initialDate = new Date(period.start_time);

      setDetails({
        group,
        activity:
          activity &&
          !activity.deleted_at &&
          !isHiddenGroupDefaultActivity(activity)
            ? activity
            : null,
        period,
        entry,
      });
      setGroupActivities(
        activities.filter((item) => !isHiddenGroupDefaultActivity(item))
      );
      setSelectedActivityId(
        activity &&
          !activity.deleted_at &&
          !isHiddenGroupDefaultActivity(activity)
          ? activity.id
          : NONE_ACTIVITY_VALUE
      );
      setSelectedDate(initialDate);
      setStartTime(formatTimeInput(period.start_time));
      setEndTime(formatTimeInput(period.end_time));
      setLoading(false);
    };

    void load();
  }, [finish, groupId, sessionId]);

  const handleDelete = useCallback(async () => {
    if (!sessionId) return;
    try {
      await db.activityPeriods.update(sessionId, {
        deleted_at: now(),
        updated_at: now(),
      });
      onUpdatedRef.current?.();
      finish();
    } catch (deleteError) {
      console.error("Error deleting session:", deleteError);
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

    // If end clock < start clock the session spans overnight; end falls on the
    // next calendar day.
    const crossesMidnightSave =
      !isRunning && !!endTime && timeToSeconds(endTime) < timeToSeconds(startTime);
    const endDate = crossesMidnightSave ? shiftDate(selectedDate, 1) : selectedDate;

    const nextEndIso = isRunning
      ? null
      : endTime
        ? combineDateAndTime(endDate, endTime)
        : null;

    // Only block truly zero-length sessions (equal times).
    if (
      nextEndIso &&
      new Date(nextEndIso).getTime() === new Date(nextStartIso).getTime()
    ) {
      setError("End time must be different from start time.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const nextActivityId =
        selectedActivityId === NONE_ACTIVITY_VALUE
          ? (await getOrCreateHiddenGroupDefaultActivity(details.group)).id
          : selectedActivityId;

      const selectedDateString = toDateString(selectedDate);
      const entry = await getOrCreateDailyEntry(selectedDateString);
      const n = now();

      await db.activityPeriods.update(sessionId, {
        activity_id: nextActivityId,
        daily_entry_id: entry.id,
        start_time: nextStartIso,
        end_time: nextEndIso,
        updated_at: n,
      });

      if (isRunning) {
        await db.dailyEntries.update(entry.id, {
          current_activity_id: nextActivityId,
          updated_at: n,
        });
        // If the session was moved to a different day, clear the old entry's
        // running indicator.
        if (details.period.daily_entry_id !== entry.id) {
          await db.dailyEntries.update(details.period.daily_entry_id, {
            current_activity_id: null,
            updated_at: n,
          });
        }
      }

      onUpdatedRef.current?.();
      finish();
    } catch (saveError) {
      console.error("Error saving session:", saveError);
      setError(ERROR_MESSAGES.SAVE_SESSION);
    } finally {
      setSaving(false);
    }
  }, [
    sessionId,
    details,
    startTime,
    endTime,
    selectedDate,
    selectedActivityId,
    finish,
  ]);

  const isRunningSession =
    details?.period != null && details.period.end_time === null;

  // A session crosses midnight if endTime < startTime on the clock.
  // It spans two *logical* days only if it also crosses the reset boundary
  // (end time >= reset time). e.g. 11 PM → 3 AM with a 4 AM reset stays on
  // the same logical day; 11 PM → 5 AM crosses into the next logical day.
  const crossesMidnight =
    !isRunningSession &&
    !!startTime &&
    !!endTime &&
    timeToSeconds(endTime) < timeToSeconds(startTime);

  const resetMinutes = getDayResetMinutes();
  const resetSeconds = resetMinutes * 60;

  const spansOvernight =
    crossesMidnight && timeToSeconds(endTime ?? "00:00:00") >= resetSeconds;

  return {
    NONE_ACTIVITY_VALUE,
    loading,
    saving,
    error,
    details,
    isRunningSession,
    spansOvernight,
    resetMinutes,
    groupActivities,
    selectedActivityId,
    setSelectedActivityId,
    selectedDate,
    setSelectedDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    handleDelete,
    handleSave,
    today: useMemo(() => fromDateString(getEffectiveToday()), []),
  };
}
