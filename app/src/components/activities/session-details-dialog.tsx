import {
  FormDialog,
  FormDialogActions,
  FormSelectField,
  FormStack,
} from "@/components/forms";
import { SessionTimeNoteFields } from "@/components/activities/session-time-note-fields";
import { getActivityDisplayName } from "@/lib/activity";
import { toDateString } from "@/lib/time-utils";
import { useSessionDetails } from "@/components/activities/hooks/use-session-details";
import { isActivityDateEditable } from "@/lib/journal/editable-window";
import { useCallback } from "react";

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
    spanWarning,
    groupActivities,
    selectedActivityId,
    setSelectedActivityId,
    selectedDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    note,
    setNote,
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
          <SessionTimeNoteFields
            startId="session-start-time"
            endId="session-end-time"
            noteId="session-note"
            startLabel="Start time"
            endLabel="End time"
            noteLabel="Note"
            notePlaceholder="What did you do?"
            startTime={startTime}
            endTime={endTime}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            note={note}
            onNoteChange={setNote}
            endReadOnlyValue={isRunningSession ? "Still running" : undefined}
            disabled={isLockedHistoricalSession}
          />
          {spanWarning && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {spanWarning}
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
              onClick: isLockedHistoricalSession
                ? () => undefined
                : handleDelete,
              disabled: isLockedHistoricalSession,
              destructive: true,
            }}
          />
        </FormStack>
      )}
    </FormDialog>
  );
}
