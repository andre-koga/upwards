import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

import {
  getEffectiveToday,
  getDayResetMinutes,
  formatResetMinutes,
} from "@/lib/session/day-reset";

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
  const { t } = useTranslation("projects");
  const { t: tCommon } = useTranslation("common");
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
      resetMinutes
    );
  }, [dateString, startTime, endTime, resetMinutes]);

  const spanWarning = useMemo(() => {
    if (
      !resolvedPeriod ||
      !spansLogicalDays(resolvedPeriod.startMs, resolvedPeriod.endMs)
    ) {
      return null;
    }
    const startDay = formatWeekdayShortDate(
      fromDateString(effectiveDateForMs(resolvedPeriod.startMs))
    );
    const endDay = formatWeekdayShortDate(
      fromDateString(
        getLogicalEndDate(resolvedPeriod.startMs, resolvedPeriod.endMs)
      )
    );
    return t("manualEntry.spanWarning", {
      startDay,
      endDay,
      resetTime: formatResetMinutes(resetMinutes),
    });
  }, [resolvedPeriod, resetMinutes, t]);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
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
    }
  }

  const handleSave = async () => {
    if (!activity) return;

    if (!startTime || !endTime) {
      setError(t("manualEntry.errorBothTimes"));
      return;
    }

    if (timeToSeconds(endTime) === timeToSeconds(startTime)) {
      setError(t("manualEntry.errorSameTime"));
      return;
    }

    const { startIso, endIso, startMs, endMs } = resolvePeriodFromLogicalDay(
      dateString,
      startTime,
      endTime,
      resetMinutes
    );

    const nowMs = Date.now();
    if (endMs > nowMs) {
      setError(t("manualEntry.errorEndFuture"));
      return;
    }
    if (startMs > nowMs) {
      setError(t("manualEntry.errorStartFuture"));
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
      setError(t("manualEntry.errorSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("manualEntry.title")}
      description={
        activity
          ? t("manualEntry.description", {
              name: getActivityDisplayName(activity, group),
            })
          : undefined
      }
      contentClassName="sm:max-w-md"
    >
      <FormStack>
        <FormCalendarDateField
          id="manual-entry-date"
          label={t("manualEntry.date")}
          value={dateString}
          max={todayString}
          onValueChange={(value) => {
            if (!value) return;
            setDateString(value);
          }}
        />

        <FormTimeField
          id="manual-entry-start"
          label={t("manualEntry.startTime")}
          value={startTime}
          onValueChange={setStartTime}
        />

        <FormTimeField
          id="manual-entry-end"
          label={t("manualEntry.endTime")}
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
          confirmLabel={saving ? tCommon("saving") : tCommon("save")}
          confirmDisabled={saving || !activity}
          secondaryAction={{
            label: tCommon("cancel"),
            onClick: () => onOpenChange(false),
            disabled: saving,
          }}
        />
      </FormStack>
    </FormDialog>
  );
}
