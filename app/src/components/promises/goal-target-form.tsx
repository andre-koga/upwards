/**
 * Reusable form for configuring a streak-based goal target.
 * Used on both the "Start a Goal" (create) and "Extend" flows.
 *
 * When `lockedKind` is provided the user cannot switch kinds — only the
 * value field for the existing kind is shown (extend mode).
 */
import { useState } from "react";
import {
  FormCalendarDateField,
  FormDialogActions,
  FormField,
  FormStack,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import type { GoalTargetInput, GoalTargetKind } from "@/lib/db/types";

interface GoalTargetFormProps {
  /** Pre-filled initial values (extend mode). */
  initial?: GoalTargetInput;
  /** When set, the kind toggle is hidden and this kind is forced. */
  lockedKind?: GoalTargetKind;
  /** Min streak value to accept (used in extend mode to reject non-increases). */
  minStreak?: number;
  /** Min end date to accept. Defaults to today. */
  minEndDate?: string;
  submitLabel?: string;
  onSubmit: (target: GoalTargetInput) => void | Promise<void>;
  onCancel?: () => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GoalTargetForm({
  initial,
  lockedKind,
  minStreak,
  minEndDate,
  submitLabel = "Set Goal",
  onSubmit,
  onCancel,
}: GoalTargetFormProps) {
  const defaultKind: GoalTargetKind = lockedKind ?? initial?.kind ?? "streak_count";
  const [kind, setKind] = useState<GoalTargetKind>(defaultKind);
  const [streakValue, setStreakValue] = useState<string>(
    initial?.kind === "streak_count" ? String(initial.streak) : ""
  );
  const [dateValue, setDateValue] = useState<string>(
    initial?.kind === "streak_until" ? initial.endDate : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const effectiveMinStreak = minStreak ?? 1;
  const effectiveMinDate = minEndDate ?? todayStr();

  const handleSubmit = async () => {
    setValidationError(null);

    let target: GoalTargetInput;
    if (kind === "streak_count") {
      const n = parseInt(streakValue, 10);
      if (!streakValue || isNaN(n) || n < effectiveMinStreak) {
        setValidationError(
          effectiveMinStreak > 1
            ? `Must be greater than ${effectiveMinStreak - 1}`
            : "Enter a number of days (min 1)"
        );
        return;
      }
      target = { kind: "streak_count", streak: n };
    } else {
      if (!dateValue || dateValue < effectiveMinDate) {
        setValidationError(
          effectiveMinDate > todayStr()
            ? `Must be after ${effectiveMinDate}`
            : "Pick a date from today onwards"
        );
        return;
      }
      target = { kind: "streak_until", endDate: dateValue };
    }

    setSubmitting(true);
    try {
      await onSubmit(target);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormStack className="space-y-5">
      {/* Kind toggle — hidden when kind is locked (extend mode) */}
      {!lockedKind && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={kind === "streak_count" ? "default" : "outline"}
            className="h-auto py-2"
            onClick={() => {
              setKind("streak_count");
              setValidationError(null);
            }}
          >
            Reach a streak
          </Button>
          <Button
            type="button"
            variant={kind === "streak_until" ? "default" : "outline"}
            className="h-auto py-2"
            onClick={() => {
              setKind("streak_until");
              setValidationError(null);
            }}
          >
            Until a date
          </Button>
        </div>
      )}

      {kind === "streak_count" ? (
        <FormField
          id="streak-input"
          label="Streak target (days)"
          type="number"
          min={effectiveMinStreak}
          placeholder="e.g. 30"
          value={streakValue}
          disabled={submitting}
          onChange={(event) => {
            setStreakValue(event.target.value);
            setValidationError(null);
          }}
          message="Keep the habit going until you hit this streak."
        />
      ) : (
        <FormCalendarDateField
          id="date-input"
          label="Keep streak alive until"
          value={dateValue}
          min={effectiveMinDate}
          disabled={submitting}
          placeholder="Select end date"
          onValueChange={(value) => {
            setDateValue(value);
            setValidationError(null);
          }}
          message="Don't break the streak before this date."
        />
      )}

      {validationError ? (
        <p className="text-xs text-destructive">{validationError}</p>
      ) : null}

      <FormDialogActions
        onConfirm={() => void handleSubmit()}
        confirmLabel={submitting ? "Saving…" : submitLabel}
        confirmDisabled={submitting}
        secondaryAction={
          onCancel
            ? {
                label: "Back",
                onClick: onCancel,
                disabled: submitting,
              }
            : undefined
        }
      />
    </FormStack>
  );
}
