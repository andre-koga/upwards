import { useEffect, useMemo, useState } from "react";
import {
  FormCalendarDateField,
  FormDialog,
  FormDialogActions,
  FormStack,
  FormTimeField,
} from "@/components/forms";
import { getActivityDisplayName } from "@/lib/activity";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  combineDateAndTime,
  formatTimeInput,
  fromDateString,
  shiftDate,
  timeToSeconds,
  toDateString,
} from "@/lib/time-utils";

import { getEffectiveToday } from "@/lib/session/day-reset";

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

  // True when end clock time is before start clock time (crosses midnight).
  const spansOvernight = !!startTime && !!endTime &&
    timeToSeconds(endTime) < timeToSeconds(startTime);

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

    // Equal times produce zero-length sessions — still block that.
    if (timeToSeconds(endTime) === timeToSeconds(startTime)) {
      setError("End time must be different from start time.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const startDate = fromDateString(dateString);
      // If end is before start on the clock it means the session crossed
      // midnight, so the end falls on the next calendar day.
      const endDate = spansOvernight ? shiftDate(startDate, 1) : startDate;

      await onSave({
        activityId: activity.id,
        dateString,
        startIso: combineDateAndTime(startDate, startTime),
        endIso: combineDateAndTime(endDate, endTime),
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

        {spansOvernight && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            This session spans two days.
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
