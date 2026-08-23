import type { ReactNode } from "react";
import {
  FormCharacterCount,
  FormField,
  FormRow,
  FormTextareaField,
  FormTimeField,
} from "@/components/forms";
import { SESSION_NOTE_MAX_LENGTH } from "@/lib/activity/session-note";

interface SessionTimeNoteFieldsProps {
  startId: string;
  endId: string;
  noteId: string;
  startLabel: ReactNode;
  endLabel: ReactNode;
  noteLabel: ReactNode;
  notePlaceholder?: string;
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  /** When set, the end field is a read-only display (e.g. a running session). */
  endReadOnlyValue?: string;
  disabled?: boolean;
}

export function SessionTimeNoteFields({
  startId,
  endId,
  noteId,
  startLabel,
  endLabel,
  noteLabel,
  notePlaceholder,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  note,
  onNoteChange,
  endReadOnlyValue,
  disabled = false,
}: SessionTimeNoteFieldsProps) {
  return (
    <>
      <FormRow className="items-end gap-3">
        <FormTimeField
          id={startId}
          label={startLabel}
          value={startTime}
          onValueChange={onStartTimeChange}
          disabled={disabled}
          containerClassName="min-w-0 flex-1"
        />
        {endReadOnlyValue != null ? (
          <FormField
            id={endId}
            label={endLabel}
            value={endReadOnlyValue}
            readOnly
            containerClassName="min-w-0 flex-1"
          />
        ) : (
          <FormTimeField
            id={endId}
            label={endLabel}
            value={endTime}
            onValueChange={onEndTimeChange}
            disabled={disabled}
            containerClassName="min-w-0 flex-1"
          />
        )}
      </FormRow>
      <FormTextareaField
        id={noteId}
        label={noteLabel}
        value={note}
        onChange={(event) =>
          onNoteChange(event.target.value.slice(0, SESSION_NOTE_MAX_LENGTH))
        }
        placeholder={notePlaceholder}
        maxLength={SESSION_NOTE_MAX_LENGTH}
        rows={3}
        disabled={disabled}
        message={
          <FormCharacterCount
            current={note.length}
            max={SESSION_NOTE_MAX_LENGTH}
          />
        }
      />
    </>
  );
}
