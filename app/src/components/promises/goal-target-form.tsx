/**
 * Reusable form for configuring a streak-based goal target.
 * Used on both the "Start a Goal" (create) and "Extend" flows.
 *
 * When `lockedKind` is provided the user cannot switch kinds — only the
 * value field for the existing kind is shown (extend mode).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="space-y-5">
      {/* Kind toggle — hidden when kind is locked (extend mode) */}
      {!lockedKind && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setKind("streak_count"); setValidationError(null); }}
            className={[
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              kind === "streak_count"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted/40",
            ].join(" ")}
          >
            Reach a streak
          </button>
          <button
            type="button"
            onClick={() => { setKind("streak_until"); setValidationError(null); }}
            className={[
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              kind === "streak_until"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted/40",
            ].join(" ")}
          >
            Until a date
          </button>
        </div>
      )}

      {/* Value input */}
      {kind === "streak_count" ? (
        <div className="space-y-1.5">
          <Label htmlFor="streak-input">Streak target (days)</Label>
          <Input
            id="streak-input"
            type="number"
            min={effectiveMinStreak}
            placeholder="e.g. 30"
            value={streakValue}
            onChange={(e) => { setStreakValue(e.target.value); setValidationError(null); }}
          />
          <p className="text-xs text-muted-foreground">
            Keep the habit going until you hit this streak.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="date-input">Keep streak alive until</Label>
          <Input
            id="date-input"
            type="date"
            min={effectiveMinDate}
            value={dateValue}
            onChange={(e) => { setDateValue(e.target.value); setValidationError(null); }}
          />
          <p className="text-xs text-muted-foreground">
            Don't break the streak before this date.
          </p>
        </div>
      )}

      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Back
          </Button>
        )}
        <Button
          type="button"
          className="flex-1"
          disabled={submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
