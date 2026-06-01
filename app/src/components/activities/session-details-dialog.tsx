import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormSelectField,
  FormStack,
  FormTimeField,
} from "@/components/forms";
import { getActivityDisplayName } from "@/lib/activity";
import { toDateString, timeToSeconds } from "@/lib/time-utils";
import { useSessionDetails } from "@/components/activities/hooks/use-session-details";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { useCallback } from "react";

interface SessionDetailsDialogProps {
  groupId: string;
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionUpdated?: () => void;
}

function addOneSecond(time: string): string {
  const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);
  const totalSeconds = Math.min(hours * 3600 + minutes * 60 + seconds + 1, 86399);
  const nextHours = Math.floor(totalSeconds / 3600);
  const nextMinutes = Math.floor((totalSeconds % 3600) / 60);
  const nextSeconds = totalSeconds % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(
    2,
    "0"
  )}:${String(nextSeconds).padStart(2, "0")}`;
}

export default function SessionDetailsDialog({
  groupId,
  sessionId,
  open,
  onOpenChange,
  onSessionUpdated,
}: SessionDetailsDialogProps) {
  const handleDone = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const {
    NONE_ACTIVITY_VALUE,
    loading,
    saving,
    error,
    details,
    isRunningSession,
    groupActivities,
    selectedActivityId,
    setSelectedActivityId,
    selectedDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    handleDelete,
    handleSave,
  } = useSessionDetails({
    groupId,
    sessionId: sessionId ?? undefined,
    onDone: handleDone,
    onUpdated: onSessionUpdated,
  });

  if (!sessionId) return null;

  const sessionDateString = details?.entry?.date ?? toDateString(selectedDate);
  const isLockedHistoricalSession =
    !!details && sessionDateString !== getEffectiveToday();

  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    if (endTime && timeToSeconds(endTime) <= timeToSeconds(newStartTime)) {
      setEndTime(addOneSecond(newStartTime));
    }
  };

  const handleEndTimeChange = (newEndTime: string) => {
    if (startTime && timeToSeconds(newEndTime) <= timeToSeconds(startTime)) {
      setEndTime(addOneSecond(startTime));
      return;
    }
    setEndTime(newEndTime);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Session Details"
      contentClassName="max-h-[90vh] overflow-y-auto sm:max-w-xl"
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !details ? (
        <p className="text-sm text-muted-foreground">Session not found.</p>
      ) : (
        <FormStack>
          <FormSelectField
            id="session-activity"
            label="Activity"
            value={selectedActivityId}
            onValueChange={setSelectedActivityId}
            options={[
              { value: NONE_ACTIVITY_VALUE, label: "None" },
              ...groupActivities.map((activity) => ({
                value: activity.id,
                label: getActivityDisplayName(activity, details.group),
              })),
            ]}
            disabled={isLockedHistoricalSession}
          />
          <FormTimeField
            id="session-start-time"
            label="Start time"
            value={startTime}
            onValueChange={handleStartTimeChange}
            disabled={isLockedHistoricalSession}
          />
          {isRunningSession ? (
            <FormField
              id="session-end-time-running"
              label="End time"
              value="Still running"
              readOnly
            />
          ) : (
            <FormTimeField
              id="session-end-time"
              label="End time"
              value={endTime}
              onValueChange={handleEndTimeChange}
              disabled={isLockedHistoricalSession}
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {isLockedHistoricalSession ? (
            <p className="text-sm text-muted-foreground">
              Sessions from past days are read-only.
            </p>
          ) : null}

          <FormDialogActions
            onConfirm={isLockedHistoricalSession ? () => undefined : handleSave}
            confirmLabel={saving ? "Saving..." : "Save"}
            confirmDisabled={saving || isLockedHistoricalSession}
            secondaryAction={{
              label: "Delete",
              onClick: isLockedHistoricalSession ? () => undefined : handleDelete,
              disabled: isLockedHistoricalSession,
              destructive: true,
            }}
          />
        </FormStack>
      )}
    </FormDialog>
  );
}
