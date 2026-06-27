import { useEffect, useMemo, useState } from "react";
import {
  FormCalendarDateField,
  FormDialog,
  FormDialogActions,
  FormStack,
  FormTimeField,
} from "@/components/forms";
import { getActivityDisplayName } from "@/lib/activity";
import {
  effectiveDateForMs,
  getLogicalEndDate,
  resolvePeriodFromLogicalDay,
  spansLogicalDays,
} from "@/lib/activity/period-day-utils";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  formatTimeInput,
  formatWeekdayShortDate,
  fromDateString,
  timeToSeconds,
  toDateString,
} from "@/lib/time-utils";

import { getEffectiveToday, getDayResetMinutes, formatResetMinutes } from "@/lib/session/day-reset";

interface ManualTimeEntryDialogProps {
  open: boolean;
  activity: Activity | null;
  group: ActivityGroup | undefined;
  initialDate: Date;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: {
    activityId: string;
    dateString: string;
    startIso: string;
    endIso: string;
  }) => Promise<void>;
}

export default function ManualTimeEntryDialog({
  open,
  activity,
  group,
  initialDate,
  onOpenChange,
  onSave,
}: ManualTimeEntryDialogProps) {
  const [dateString, setDateString] = useState(() => toDateString(initialDate));
  const [startTime, setStartTime] = useState("09:00:00");
  const [endTime, setEndTime] = useState("09:30:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayString = useMemo(() => getEffectiveToday(), []);
  const resetMinutes = useMemo(() => getDayResetMinutes(), []);

  const resolvedPeriod = useMemo(() => {
    if (!startTime || !endTime) return null;
    if (timeToSeconds(endTime) === timeToSeconds(startTime)) return null;
    return resolvePeriodFromLogicalDay(
      dateString,
      startTime,
      endTime,
      resetMinutes,
    );
  }, [dateString, startTime, endTime, resetMinutes]);

  const spanWarning = useMemo(() => {
    if (!resolvedPeriod || !spansLogicalDays(resolvedPeriod.startMs, resolvedPeriod.endMs)) {
      return null;
    }
    const startDay = formatWeekdayShortDate(
      fromDateString(effectiveDateForMs(resolvedPeriod.startMs)),
    );
    const endDay = formatWeekdayShortDate(
      fromDateString(getLogicalEndDate(resolvedPeriod.startMs, resolvedPeriod.endMs)),
    );
    return `This session spans ${startDay} and ${endDay} (crosses your ${formatResetMinutes(resetMinutes)} day boundary).`;
  }, [resolvedPeriod, resetMinutes]);

  useEffect(() => {
    if (!open) return;

    const baseDateString = toDateString(initialDate);
    const now = new Date();
    const hasTodayDefaults = baseDateString === getEffectiveToday();

    setDateString(baseDateString);
    setStartTime(
      hasTodayDefaults
        ? formatTimeInput(
            new Date(now.getTime() - 5 * 60 * 1000).toISOString()
          )
        : "09:00:00"
    );
    setEndTime(
      hasTodayDefaults ? formatTimeInput(now.toISOString()) : "09:05:00"
    );
    setSaving(false);
    setError(null);
  }, [open, initialDate]);

  const handleSave = async () => {
    if (!activity) return;

    if (!startTime || !endTime) {
      setError("Please set both start and end times.");
      return;
    }

    if (timeToSeconds(endTime) === timeToSeconds(startTime)) {
      setError("End time must be different from start time.");
      return;
    }

    const { startIso, endIso, startMs, endMs } = resolvePeriodFromLogicalDay(
      dateString,
      startTime,
      endTime,
      resetMinutes,
    );

    const nowMs = Date.now();
    if (endMs > nowMs) {
      setError("End time can't be in the future.");
      return;
    }
    if (startMs > nowMs) {
      setError("Start time can't be in the future.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSave({
        activityId: activity.id,
        dateString: effectiveDateForMs(startMs),
        startIso,
        endIso,
      });

      onOpenChange(false);
    } catch (saveError) {
      console.error("Error creating manual activity entry:", saveError);
      setError("Failed to save entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add time entry"
      description={
        activity
          ? `Manual session for ${getActivityDisplayName(activity, group)}`
          : undefined
      }
      contentClassName="sm:max-w-md"
    >
      <FormStack>
        <FormCalendarDateField
          id="manual-entry-date"
          label="Date"
          value={dateString}
          max={todayString}
          onValueChange={(value) => {
            if (!value) return;
            setDateString(value);
          }}
        />

        <FormTimeField
          id="manual-entry-start"
          label="Start time"
          value={startTime}
          onValueChange={setStartTime}
        />

        <FormTimeField
          id="manual-entry-end"
          label="End time"
          value={endTime}
          onValueChange={setEndTime}
        />

        {spanWarning && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {spanWarning}
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <FormDialogActions
          onConfirm={handleSave}
          confirmLabel={saving ? "Saving..." : "Save"}
          confirmDisabled={saving || !activity}
          secondaryAction={{
            label: "Cancel",
            onClick: () => onOpenChange(false),
            disabled: saving,
          }}
        />
      </FormStack>
    </FormDialog>
  );
}
