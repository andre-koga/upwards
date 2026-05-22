/**
 * Streak-only goal target form for create and extend flows.
 */
import { useState } from "react";
import {
  FormDialogActions,
  FormField,
  FormStack,
} from "@/components/forms";
import type { GoalTargetInput, GoalTargetKind } from "@/lib/db/types";

interface GoalTargetFormProps {
  initial?: GoalTargetInput;
  /** When set, only show the field for this legacy kind (extend on streak_until goals). */
  lockedKind?: GoalTargetKind;
  minStreak?: number;
  minEndDate?: string;
  submitLabel?: string;
  onSubmit: (target: GoalTargetInput) => void | Promise<void>;
  onCancel?: () => void;
  confirmDisabled?: boolean;
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
  confirmDisabled = false,
}: GoalTargetFormProps) {
  const effectiveKind: GoalTargetKind = lockedKind ?? "streak_count";
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
    if (effectiveKind === "streak_count") {
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
    <FormStack className="space-y-3">
      <div className="space-y-2">
        {effectiveKind === "streak_count" ? (
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
          <FormField
            id="date-input"
            label="Keep streak alive until"
            type="date"
            min={effectiveMinDate}
            value={dateValue}
            disabled={submitting}
            onChange={(event) => {
              setDateValue(event.target.value);
              setValidationError(null);
            }}
            message="Legacy date-based goal — pick a later end date to extend."
          />
        )}
      </div>

      {validationError ? (
        <p className="text-xs text-destructive">{validationError}</p>
      ) : null}

      <FormDialogActions
        onConfirm={() => void handleSubmit()}
        confirmLabel={submitting ? "Saving…" : submitLabel}
        confirmDisabled={submitting || confirmDisabled}
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
