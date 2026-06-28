import { useEffect, useState } from "react";
import {
  FormCharacterCount,
  FormDialog,
  FormDialogActions,
  FormStack,
  FormTextareaField,
  FormToggleButton,
} from "@/components/forms";
import { dialogFieldLabelClassName } from "@/components/forms/styles";
import RoutineSelector, {
  MEMO_ROUTINE_OPTIONS,
} from "@/components/activities/routine-selector";
import {
  buildRoutineString,
  computeRoutineFormFromString,
  DEFAULT_ROUTINE_FORM,
  type RoutineFormData,
} from "@/lib/activity/routine-form";
import type { RecurringMemo } from "@/lib/db/types";
import { MEMO_TITLE_LIMIT } from "@/components/tasks/memo-title";
import { Pin } from "lucide-react";

interface RecurringMemoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memo?: RecurringMemo | null;
  onSave: (values: {
    title: string;
    routine: string;
    is_pinned: boolean;
  }) => Promise<boolean>;
  onDelete?: () => void;
}

export function RecurringMemoEditDialog({
  open,
  onOpenChange,
  memo,
  onSave,
  onDelete,
}: RecurringMemoEditDialogProps) {
  const isEditing = Boolean(memo);
  const [title, setTitle] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [routineForm, setRoutineForm] = useState<RoutineFormData>(DEFAULT_ROUTINE_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- re-initialize form when dialog opens */
    setTitle(memo?.title ?? "");
    setIsPinned(!!memo?.is_pinned);
    setRoutineForm(computeRoutineFormFromString(memo?.routine));
    setSaving(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, memo]);

  const handleConfirm = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (routineForm.routine === "weekly" && routineForm.weeklyDays.length === 0) {
      return;
    }

    setSaving(true);
    try {
      const saved = await onSave({
        title: trimmed,
        routine: buildRoutineString(routineForm),
        is_pinned: isPinned,
      });
      if (saved) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleConfirm();
    }
    if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  const confirmDisabled =
    saving ||
    !title.trim() ||
    (routineForm.routine === "weekly" && routineForm.weeklyDays.length === 0);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit recurring memo" : "New recurring memo"}
      contentClassName="sm:max-w-md"
    >
      <FormStack className="space-y-2">
        <FormTextareaField
          id="recurring-memo-title"
          label="Memo title"
          labelClassName="sr-only"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. meds"
          maxLength={MEMO_TITLE_LIMIT}
          rows={3}
          message={
            <FormCharacterCount current={title.length} max={MEMO_TITLE_LIMIT} />
          }
        />
        <div className="space-y-2">
          <p className={dialogFieldLabelClassName}>Repeat</p>
          <RoutineSelector
            routine={routineForm.routine}
            weeklyDays={routineForm.weeklyDays}
            monthlyDay={routineForm.monthlyDay}
            customInterval={routineForm.customInterval}
            customUnit={routineForm.customUnit}
            options={MEMO_ROUTINE_OPTIONS}
            trailingSlot={
              <FormToggleButton
                toggled={isPinned}
                onToggle={setIsPinned}
                label={isPinned ? "Unpin memo" : "Pin memo"}
              >
                <Pin className={isPinned ? "h-4 w-4 fill-current" : "h-4 w-4"} />
              </FormToggleButton>
            }
            onRoutineChange={(value) =>
              setRoutineForm((prev) => ({ ...prev, routine: value }))
            }
            onWeeklyDaysChange={(days) =>
              setRoutineForm((prev) => ({ ...prev, weeklyDays: days }))
            }
            onMonthlyDayChange={(day) =>
              setRoutineForm((prev) => ({ ...prev, monthlyDay: day }))
            }
            onCustomIntervalChange={(interval) =>
              setRoutineForm((prev) => ({ ...prev, customInterval: interval }))
            }
            onCustomUnitChange={(unit) =>
              setRoutineForm((prev) => ({ ...prev, customUnit: unit }))
            }
          />
        </div>
      </FormStack>
      <FormDialogActions
        onConfirm={() => void handleConfirm()}
        confirmLabel={saving ? "Saving..." : isEditing ? "Save" : "Add"}
        confirmDisabled={confirmDisabled}
        secondaryAction={
          onDelete
            ? {
                label: "Delete",
                onClick: onDelete,
                destructive: true,
              }
            : undefined
        }
      />
    </FormDialog>
  );
}
