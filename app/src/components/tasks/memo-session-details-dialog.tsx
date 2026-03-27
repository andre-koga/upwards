/**
 * SRP: Renders the edit-memo-session form inside a dialog (date, start/end time, delete).
 */
import {
  FormDateField,
  FormDialog,
  FormDialogActions,
  FormField,
  FormStack,
} from "@/components/forms";
import { fromDateString, timeToSeconds, toDateString } from "@/lib/date-utils";
import { useMemoSessionDetails } from "@/components/tasks/hooks/use-memo-session-details";
import { useCallback } from "react";

interface MemoSessionDetailsDialogProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionUpdated?: () => void;
}

export default function MemoSessionDetailsDialog({
  sessionId,
  open,
  onOpenChange,
  onSessionUpdated,
}: MemoSessionDetailsDialogProps) {
  const handleDone = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const {
    loading,
    saving,
    error,
    details,
    isRunningSession,
    selectedDate,
    setSelectedDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    handleDelete,
    handleSave,
    today,
  } = useMemoSessionDetails({
    sessionId: sessionId ?? undefined,
    onDone: handleDone,
    onUpdated: onSessionUpdated,
  });

  if (!sessionId) return null;

  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    if (endTime && timeToSeconds(endTime) < timeToSeconds(newStartTime)) {
      setEndTime(newStartTime);
    }
  };

  const handleEndTimeChange = (newEndTime: string) => {
    if (startTime && timeToSeconds(newEndTime) < timeToSeconds(startTime)) {
      setEndTime(startTime);
      return;
    }
    setEndTime(newEndTime);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Memo Session"
      contentClassName="max-h-[90vh] overflow-y-auto sm:max-w-xl"
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !details ? (
        <p className="text-sm text-muted-foreground">Session not found.</p>
      ) : (
        <FormStack>
          <FormField
            id="memo-session-name"
            label="Memo"
            value={details.memo.title}
            readOnly
          />
          <FormDateField
            id="memo-session-date"
            label="Date"
            value={toDateString(selectedDate)}
            max={toDateString(today)}
            readOnly={isRunningSession}
            onChange={(event) => {
              if (isRunningSession || !event.target.value) return;
              setSelectedDate(fromDateString(event.target.value));
            }}
          />
          <FormField
            id="memo-session-start-time"
            label="Start time"
            type="time"
            step={1}
            value={startTime}
            onChange={(event) => handleStartTimeChange(event.target.value)}
          />
          {isRunningSession ? (
            <FormField
              id="memo-session-end-time-running"
              label="End time"
              value="Still running"
              readOnly
            />
          ) : (
            <FormField
              id="memo-session-end-time"
              label="End time"
              type="time"
              step={1}
              value={endTime}
              onChange={(event) => handleEndTimeChange(event.target.value)}
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <FormDialogActions
            onConfirm={handleSave}
            confirmLabel={saving ? "Saving..." : "Save"}
            confirmDisabled={saving}
            secondaryAction={{
              label: "Delete",
              onClick: handleDelete,
              destructive: true,
            }}
          />
        </FormStack>
      )}
    </FormDialog>
  );
}
