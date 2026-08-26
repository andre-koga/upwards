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
  effectiveDateForMs,
  getLogicalEndDate,
  resolvePeriodFromLogicalDay,
  spansLogicalDays,
  timestampForLogicalDayTime,
} from "@/lib/activity/period-day-utils";
import {
  toDateString,
  formatTimeInput,
  formatWeekdayShortDate,
  timeToSeconds,
  fromDateString,
} from "@/lib/time-utils";
import { ERROR_MESSAGES } from "@/lib/error-utils";
import { normalizeSessionNote } from "@/lib/activity/session-note";
import {
  resolveClosedSessionTimes,
  isUntimedPeriod,
} from "@/lib/activity/untimed-period";
import {
  getEffectiveToday,
  getDayResetMinutes,
  formatResetMinutes,
} from "@/lib/session/day-reset";
import { useTranslation } from "react-i18next";
import {
  getOrCreateDailyEntryProjection,
  patchTimedPeriod,
  setCurrentActivityLocal,
} from "@/lib/sync/mutate-synced";

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
  const { t } = useTranslation("projects");
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
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    fromDateString(getEffectiveToday())
  );
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");

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

      const startMs = new Date(period.start_time).getTime();
      const logicalDateStr = effectiveDateForMs(startMs);

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
      setSelectedDate(fromDateString(logicalDateStr));
      const untimed = isUntimedPeriod(period.start_time, period.end_time);
      setStartTime(formatTimeInput(period.start_time));
      setEndTime(untimed ? "" : formatTimeInput(period.end_time));
      setNote(period.note ?? "");
      setLoading(false);
    };

    void load();
  }, [finish, groupId, sessionId]);

  const handleDelete = useCallback(async () => {
    if (!sessionId) return;
    try {
      await patchTimedPeriod(sessionId, {
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

    const isRunning = details.period.end_time === null;
    const logicalDateStr = toDateString(selectedDate);
    const resetMinutes = getDayResetMinutes();

    let nextStartIso: string;
    let nextEndIso: string | null;

    if (isRunning) {
      if (!startTime) {
        setError(t("sessionDetails.errorStartRequired"));
        return;
      }
      const startMs = timestampForLogicalDayTime(
        logicalDateStr,
        startTime,
        resetMinutes
      );
      nextStartIso = new Date(startMs).toISOString();
      nextEndIso = null;
    } else {
      const resolved = resolveClosedSessionTimes({
        startTime,
        endTime,
        logicalDateStr,
        resetMinutes,
        existingStartIso: details.period.start_time,
        existingEndIso: details.period.end_time,
        createdAt: details.period.created_at,
      });
      if (!resolved.ok) {
        setError(t("sessionDetails.errorOneTime"));
        return;
      }
      nextStartIso = resolved.startIso;
      nextEndIso = resolved.endIso;
    }

    try {
      setSaving(true);
      setError(null);

      const nextActivityId =
        selectedActivityId === NONE_ACTIVITY_VALUE
          ? (await getOrCreateHiddenGroupDefaultActivity(details.group)).id
          : selectedActivityId;

      const entryDateString = effectiveDateForMs(
        new Date(nextStartIso).getTime()
      );
      const entry = await getOrCreateDailyEntryProjection(entryDateString);
      const n = now();

      await patchTimedPeriod(sessionId, {
        activity_id: nextActivityId,
        daily_entry_id: entry.id,
        start_time: nextStartIso,
        end_time: nextEndIso,
        note: normalizeSessionNote(note),
        updated_at: n,
      });

      if (isRunning) {
        await setCurrentActivityLocal(entryDateString, nextActivityId);
        if (details.period.daily_entry_id !== entry.id) {
          const oldEntry =
            details.entry ??
            (await db.dailyEntries.get(details.period.daily_entry_id));
          if (oldEntry) {
            await setCurrentActivityLocal(oldEntry.date, null);
          }
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
    note,
    selectedDate,
    selectedActivityId,
    finish,
    t,
  ]);

  const isRunningSession =
    details?.period != null && details.period.end_time === null;

  const resetMinutes = getDayResetMinutes();

  const spanWarning = useMemo(() => {
    if (isRunningSession || !startTime || !endTime) return null;
    if (timeToSeconds(endTime) === timeToSeconds(startTime)) return null;

    const logicalDateStr = toDateString(selectedDate);
    const { startMs, endMs } = resolvePeriodFromLogicalDay(
      logicalDateStr,
      startTime,
      endTime,
      resetMinutes
    );

    if (!spansLogicalDays(startMs, endMs)) return null;

    const startDay = formatWeekdayShortDate(
      fromDateString(effectiveDateForMs(startMs))
    );
    const endDay = formatWeekdayShortDate(
      fromDateString(getLogicalEndDate(startMs, endMs))
    );
    return `This session spans ${startDay} and ${endDay} (crosses your ${formatResetMinutes(resetMinutes)} day boundary).`;
  }, [isRunningSession, startTime, endTime, selectedDate, resetMinutes]);

  const handleStartTimeChange = useCallback((value: string) => {
    setStartTime(value);
  }, []);

  const handleEndTimeChange = useCallback(
    (value: string) => {
      if (!value) {
        setEndTime("");
        return;
      }
      if (startTime && timeToSeconds(value) === timeToSeconds(startTime)) {
        setEndTime("");
        return;
      }
      setEndTime(value);
    },
    [startTime]
  );

  const showUntimedEnd = !isRunningSession && !endTime;

  return {
    NONE_ACTIVITY_VALUE,
    loading,
    saving,
    error,
    details,
    isRunningSession,
    spanWarning,
    resetMinutes,
    groupActivities,
    selectedActivityId,
    setSelectedActivityId,
    selectedDate,
    setSelectedDate,
    startTime,
    setStartTime: handleStartTimeChange,
    endTime,
    setEndTime: handleEndTimeChange,
    showUntimedEnd,
    note,
    setNote,
    handleDelete,
    handleSave,
    today: useMemo(() => fromDateString(getEffectiveToday()), []),
  };
}
