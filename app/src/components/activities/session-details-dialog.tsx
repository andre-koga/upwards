import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormSelectField,
  FormStack,
  FormTimeField,
} from "@/components/forms";
import { getActivityDisplayName } from "@/lib/activity";
import { toDateString } from "@/lib/time-utils";
import { useSessionDetails } from "@/components/activities/hooks/use-session-details";
import { isActivityDateEditable } from "@/lib/journal/editable-window";
import { useCallback } from "react";
import { formatResetMinutes } from "@/lib/session/day-reset";

interface SessionDetailsDialogProps {
  groupId: string;
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionUpdated?: () => void;
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
    spansOvernight,
    resetMinutes,
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
    !!details && !isActivityDateEditable(sessionDateString);

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
            onValueChange={setStartTime}
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
              onValueChange={setEndTime}
              disabled={isLockedHistoricalSession}
            />
          )}
          {spansOvernight && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              This session crosses your {formatResetMinutes(resetMinutes)} day boundary and will count across two days.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {isLockedHistoricalSession ? (
            <p className="text-sm text-muted-foreground">
              Sessions older than 7 days are read-only.
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
