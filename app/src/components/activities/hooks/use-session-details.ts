import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { db, now } from "@/lib/db";
import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import { activityTracksTime } from "@/lib/activity/tracks-time";
import { dayBoundsMs } from "@/lib/activity/period-day-utils";
import {
  toDateString,
  formatTimeInput,
  formatWeekdayShortDate,
  timeToSeconds,
  fromDateString,
  dateTimeMs,
  resolveSessionSpan,
  sessionDateRange,
  todayDateString,
} from "@/lib/time-utils";
import { ERROR_MESSAGES } from "@/lib/error-utils";
import { normalizeSessionNote } from "@/lib/activity/session-note";
import { useTranslation } from "react-i18next";
import { requestOldDayEdit } from "@/lib/journal/old-day-gate";
import {
  applyCompletionNote,
  applyCountDelta,
  getOrCreateDailyEntryProjection,
  patchTimedPeriod,
} from "@/lib/sync/mutate-synced";
import { parseDerivedUntimedSessionId } from "@/lib/activity/timeline-sessions";

interface SessionDetailsData {
  group: ActivityGroup;
  activity: Activity | null;
  period: ActivityPeriod;
  derived?: boolean;
  derivedDate?: string;
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
    fromDateString(todayDateString())
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

      const derived = parseDerivedUntimedSessionId(sessionId);
      if (derived) {
        const group = await db.activityGroups.get(groupId);
        if (!group || group.deleted_at) {
          finish();
          return;
        }
        const [activity, entry, activities] = await Promise.all([
          db.activities.get(derived.activityId),
          db.dailyEntries
            .where("date")
            .equals(derived.date)
            .filter((item) => !item.deleted_at)
            .first(),
          db.activities
            .filter((item) => item.group_id === group.id && !item.deleted_at)
            .sortBy("created_at"),
        ]);
        if (
          activity &&
          !activity.deleted_at &&
          activity.group_id !== group.id
        ) {
          finish();
          return;
        }
        const completionTime = entry?.completion_times?.[derived.activityId];
        const instant =
          completionTime && !Number.isNaN(new Date(completionTime).getTime())
            ? completionTime
            : new Date(dayBoundsMs(derived.date).startMs).toISOString();
        const virtualPeriod: ActivityPeriod = {
          id: sessionId,
          activity_id: derived.activityId,
          start_time: instant,
          end_time: instant,
          note: entry?.completion_notes?.[derived.activityId] ?? null,
          created_at: instant,
          updated_at: instant,
          synced_at: null,
          deleted_at: null,
        };
        setDetails({
          group,
          activity: activity && !activity.deleted_at ? activity : null,
          period: virtualPeriod,
          derived: true,
          derivedDate: derived.date,
        });
        setGroupActivities(activities);
        setSelectedActivityId(
          activity && !activity.deleted_at ? activity.id : ""
        );
        setSelectedDate(fromDateString(derived.date));
        setStartTime("");
        setEndTime(formatTimeInput(instant));
        setNote(virtualPeriod.note ?? "");
        setLoading(false);
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

      // Timed sessions go on activities that have a timer; check-only ones
      // can't be picked. The session's own activity stays listed regardless,
      // so editing it never loses the current choice.
      const activities = await db.activities
        .filter(
          (item) =>
            item.group_id === group.id &&
            !item.deleted_at &&
            (activityTracksTime(item) || item.id === period.activity_id)
        )
        .sortBy("created_at");

      const logicalDateStr = toDateString(new Date(period.start_time));

      setDetails({
        group,
        activity: activity && !activity.deleted_at ? activity : null,
        period,
      });
      setGroupActivities(activities);
      setSelectedActivityId(
        activity && !activity.deleted_at ? activity.id : ""
      );
      setSelectedDate(fromDateString(logicalDateStr));
      setStartTime(formatTimeInput(period.start_time));
      setEndTime(formatTimeInput(period.end_time));
      setNote(period.note ?? "");
      setLoading(false);
    };

    void load();
  }, [finish, groupId, sessionId]);

  const handleDelete = useCallback(async () => {
    if (!sessionId || !details) return;
    try {
      const { confirmed } = await requestOldDayEdit(
        details.derivedDate ??
          toDateString(new Date(details.period.start_time)),
        t("oldDay.activity.summary", { ns: "journal" })
      );
      if (!confirmed) return;
      if (details.derived) {
        const activityId = details.activity?.id ?? details.period.activity_id;
        const date = details.derivedDate;
        if (date && activityId) {
          await applyCompletionNote({
            date,
            activityId,
            note: null,
          });
        }
        onUpdatedRef.current?.();
        finish();
        return;
      }
      await patchTimedPeriod(sessionId, {
        deleted_at: now(),
        updated_at: now(),
      });
      onUpdatedRef.current?.();
      finish();
    } catch (deleteError) {
      console.error("Error deleting session:", deleteError);
    }
  }, [details, finish, sessionId, t]);

  // Only completions derived from a check-only activity have a single instant;
  // real sessions always have a span (zero-length ones were folded into
  // completion times by the cutover).
  const isUntimedSession = details?.derived === true;

  const handleSave = useCallback(async () => {
    if (!sessionId || !details) return;

    const isRunning = details.period.end_time === null;
    const logicalDateStr = toDateString(selectedDate);

    let nextStartIso: string;
    let nextEndIso: string | null;

    if (isRunning) {
      if (!startTime) {
        setError(t("sessionDetails.errorStartRequired"));
        return;
      }
      nextStartIso = new Date(
        dateTimeMs(logicalDateStr, startTime)
      ).toISOString();
      nextEndIso = null;
    } else if (isUntimedSession) {
      // A completion has one instant (its end time). It is never converted
      // into a timed span, and a span is never collapsed into a completion.
      if (!endTime) {
        setError(t("sessionDetails.errorEndRequired"));
        return;
      }
      const completionIso = new Date(
        dateTimeMs(logicalDateStr, endTime)
      ).toISOString();
      nextStartIso = completionIso;
      nextEndIso = completionIso;
    } else {
      if (!startTime) {
        setError(t("sessionDetails.errorStartRequired"));
        return;
      }
      if (!endTime) {
        setError(t("sessionDetails.errorEndRequired"));
        return;
      }
      if (timeToSeconds(startTime) === timeToSeconds(endTime)) {
        setError(t("sessionDetails.errorSameTime"));
        return;
      }
      const resolved = resolveSessionSpan(logicalDateStr, startTime, endTime);
      nextStartIso = resolved.startIso;
      nextEndIso = resolved.endIso;
    }

    if (!selectedActivityId) {
      setError(t("sessionDetails.errorActivityRequired"));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Ask before writing anything.
      const entryDateString = toDateString(new Date(nextStartIso));
      const { confirmed } = await requestOldDayEdit(
        entryDateString,
        t("oldDay.activity.summary", { ns: "journal" })
      );
      if (!confirmed) return;

      const nextActivityId = selectedActivityId;
      const n = now();
      const sessionNote = normalizeSessionNote(note);

      if (details.derived) {
        const entry = await getOrCreateDailyEntryProjection(entryDateString);
        const date = details.derivedDate ?? entryDateString;
        const currentCount = entry.task_counts?.[nextActivityId] ?? 0;
        await applyCountDelta({
          date,
          activityId: nextActivityId,
          previousCount: currentCount,
          nextCount: currentCount,
          completionAt: nextStartIso,
        });
        await applyCompletionNote({
          date,
          activityId: nextActivityId,
          note: sessionNote,
        });
      } else {
        await patchTimedPeriod(sessionId, {
          activity_id: nextActivityId,
          start_time: nextStartIso,
          end_time: nextEndIso,
          note: sessionNote,
          updated_at: n,
        });
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
    isUntimedSession,
    finish,
    t,
  ]);

  const isRunningSession =
    details?.period != null && details.period.end_time === null;

  const spanWarning = useMemo(() => {
    if (isRunningSession || !startTime || !endTime) return null;
    if (timeToSeconds(endTime) === timeToSeconds(startTime)) return null;

    const { startMs, endMs } = resolveSessionSpan(
      toDateString(selectedDate),
      startTime,
      endTime
    );
    const { startDate, endDate } = sessionDateRange(startMs, endMs);
    if (startDate === endDate) return null;

    return t("sessionDetails.spanWarning", {
      startDay: formatWeekdayShortDate(fromDateString(startDate)),
      endDay: formatWeekdayShortDate(fromDateString(endDate)),
    });
  }, [isRunningSession, startTime, endTime, selectedDate, t]);

  const handleEndTimeChange = useCallback((value: string) => {
    setEndTime(value);
  }, []);

  return {
    loading,
    saving,
    error,
    details,
    isRunningSession,
    spanWarning,
    groupActivities,
    selectedActivityId,
    setSelectedActivityId,
    selectedDate,
    setSelectedDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime: handleEndTimeChange,
    isUntimedSession,
    note,
    setNote,
    handleDelete,
    handleSave,
    today: useMemo(() => fromDateString(todayDateString()), []),
  };
}
