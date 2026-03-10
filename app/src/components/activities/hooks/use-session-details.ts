import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, newId, now } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  DailyEntry,
} from "@/lib/db/types";
import {
  getOrCreateHiddenGroupDefaultActivity,
  isHiddenGroupDefaultActivity,
} from "@/lib/activity-utils";
import {
  fromDateString,
  toDateString,
  formatTimeInput,
  combineDateAndTime,
  startOfDay,
} from "@/lib/date-utils";
import { ERROR_MESSAGES } from "@/lib/error-utils";

const NONE_ACTIVITY_VALUE = "__none__";

export interface SessionDetailsData {
  group: ActivityGroup;
  activity: Activity | null;
  period: ActivityPeriod;
  entry: DailyEntry | undefined;
}

export function useSessionDetails() {
  const { groupId, sessionId } = useParams<{
    groupId: string;
    sessionId: string;
  }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<SessionDetailsData | null>(null);
  const [groupActivities, setGroupActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const backPath = useMemo(() => {
    if (!groupId) return "/";
    return `/activities/${groupId}`;
  }, [groupId]);

  useEffect(() => {
    const load = async () => {
      if (!groupId || !sessionId) {
        navigate("/");
        return;
      }

      const [group, period] = await Promise.all([
        db.activityGroups.get(groupId),
        db.activityPeriods.get(sessionId),
      ]);

      if (!group || group.deleted_at || !period || period.deleted_at) {
        navigate(`/activities/${groupId}`);
        return;
      }

      const activity = await db.activities.get(period.activity_id);
      if (activity && !activity.deleted_at && activity.group_id !== group.id) {
        navigate(`/activities/${groupId}`);
        return;
      }

      const [entry, activities] = await Promise.all([
        db.dailyEntries.get(period.daily_entry_id),
        db.activities
          .filter((item) => item.group_id === group.id && !item.deleted_at)
          .sortBy("created_at"),
      ]);

      const initialDate = entry?.date
        ? fromDateString(entry.date)
        : new Date(period.start_time);

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
  }, [groupId, sessionId, navigate]);

  const handleDelete = useCallback(async () => {
    if (!sessionId) return;
    try {
      await db.activityPeriods.update(sessionId, {
        deleted_at: now(),
        updated_at: now(),
      });
      navigate(backPath);
    } catch (deleteError) {
      console.error("Error deleting session:", deleteError);
    }
  }, [sessionId, backPath, navigate]);

  const handleSave = useCallback(async () => {
    if (!sessionId || !details) return;

    if (!startTime) {
      setError("Please set a start time.");
      return;
    }

    const nextStartIso = combineDateAndTime(selectedDate, startTime);
    const nextEndIso = endTime
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
          current_activity_id: null,
          created_at: timestamp,
          updated_at: timestamp,
          synced_at: null,
          deleted_at: null,
        };
        await db.dailyEntries.add(created);
        dailyEntryId = created.id;
      }

      const nextActivityId =
        selectedActivityId === NONE_ACTIVITY_VALUE
          ? (await getOrCreateHiddenGroupDefaultActivity(details.group)).id
          : selectedActivityId;

      await db.activityPeriods.update(sessionId, {
        activity_id: nextActivityId,
        daily_entry_id: dailyEntryId,
        start_time: nextStartIso,
        end_time: nextEndIso,
        updated_at: now(),
      });

      navigate(backPath);
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
    backPath,
    navigate,
  ]);

  return {
    NONE_ACTIVITY_VALUE,
    loading,
    saving,
    error,
    details,
    groupActivities,
    selectedActivityId,
    setSelectedActivityId,
    selectedDate,
    setSelectedDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    backPath,
    navigate,
    handleDelete,
    handleSave,
    today: useMemo(() => startOfDay(new Date()), []),
  };
}
