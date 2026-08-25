import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FormCalendarDateField,
  FormDialog,
  FormDialogActions,
  FormStack,
} from "@/components/forms";
import { SessionTimeNoteFields } from "@/components/activities/session-time-note-fields";
import { getActivityDisplayName, normalizeSessionNote } from "@/lib/activity";
import {
  effectiveDateForMs,
  getLogicalEndDate,
  resolvePeriodFromLogicalDay,
  spansLogicalDays,
} from "@/lib/activity/period-day-utils";
import { resolveClosedSessionTimes } from "@/lib/activity/untimed-period";
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

export interface ManualTimeEntryPayload {
  activityId: string;
  dateString: string;
  startIso: string;
  endIso: string;
  note: string | null;
}

interface ManualTimeEntryDialogProps {
  open: boolean;
  activity: Activity | null;
  group: ActivityGroup | undefined;
  initialDate: Date;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: ManualTimeEntryPayload) => Promise<void>;
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
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayString = useMemo(() => getEffectiveToday(), []);
  const resetMinutes = useMemo(() => getDayResetMinutes(), []);
  const isPastDay = dateString !== todayString;

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
      const now = new Date();
      setDateString(toDateString(initialDate));
      setStartTime(formatTimeInput(now.toISOString()));
      setEndTime("");
      setNote("");
      setSaving(false);
      setError(null);
    }
  }

  const handleEndTimeChange = (value: string) => {
    if (!value) {
      setEndTime("");
      return;
    }
    if (startTime && timeToSeconds(value) === timeToSeconds(startTime)) {
      setEndTime("");
      return;
    }
    setEndTime(value);
  };

  const handleSave = async () => {
    if (!activity) return;

    if (!startTime) {
      setError(t("manualEntry.errorStartRequired"));
      return;
    }

    const nowMs = Date.now();
    let startIso: string;
    let endIso: string;

    if (!endTime || timeToSeconds(endTime) === timeToSeconds(startTime)) {
      const resolved = resolveClosedSessionTimes({
        startTime,
        endTime: endTime || "",
        logicalDateStr: dateString,
        resetMinutes,
        existingStartIso: new Date(nowMs).toISOString(),
        existingEndIso: new Date(nowMs).toISOString(),
        createdAt: new Date(nowMs).toISOString(),
      });
      if (!resolved.ok) {
        setError(t("manualEntry.errorStartRequired"));
        return;
      }
      startIso = resolved.startIso;
      endIso = resolved.endIso;
      if (new Date(startIso).getTime() > nowMs) {
        setError(t("manualEntry.errorStartFuture"));
        return;
      }
    } else {
      const { startIso: nextStartIso, endIso: nextEndIso, startMs, endMs } =
        resolvePeriodFromLogicalDay(
          dateString,
          startTime,
          endTime,
          resetMinutes
        );

      if (endMs > nowMs) {
        setError(t("manualEntry.errorEndFuture"));
        return;
      }
      if (startMs > nowMs) {
        setError(t("manualEntry.errorStartFuture"));
        return;
      }

      startIso = nextStartIso;
      endIso = nextEndIso;
    }

    try {
      setSaving(true);
      setError(null);

      await onSave({
        activityId: activity.id,
        dateString: effectiveDateForMs(new Date(startIso).getTime()),
        startIso,
        endIso,
        note: normalizeSessionNote(note),
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
      contentClassName="sm:max-w-xl"
    >
      <FormStack>
        {isPastDay ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {t("manualEntry.pastDayWarning")}
          </p>
        ) : null}

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

        <SessionTimeNoteFields
          startId="manual-entry-start"
          endId="manual-entry-end"
          noteId="manual-entry-note"
          startLabel={t("manualEntry.startTime")}
          endLabel={t("manualEntry.endTime")}
          noteLabel={t("manualEntry.note")}
          notePlaceholder={t("manualEntry.notePlaceholder")}
          startTime={startTime}
          endTime={endTime}
          onStartTimeChange={setStartTime}
          onEndTimeChange={handleEndTimeChange}
          note={note}
          onNoteChange={setNote}
          untimedEndDisplay={!endTime}
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
