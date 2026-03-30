import { useEffect, useState } from "react";
import { db, newId, now } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  isActiveActivity,
  isScheduledRoutine,
  parseRoutine,
  validateActivityData,
} from "@/lib/activity";
import { ERROR_MESSAGES } from "@/lib/error-utils";
import RoutineSelector from "@/components/activities/routine-selector";
import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormStack,
} from "@/components/forms";
import { dialogFieldLabelClassName } from "@/components/forms/styles";

const VALID_ROUTINES = ["anytime", "daily", "weekly", "custom", "never"];

interface ActivityDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ActivityGroup;
  activity?: Activity;
  onSaved?: () => void;
}

interface ActivityFormData {
  name: string;
  routine: string;
  weeklyDays: number[];
  monthlyDay: number;
  customInterval: number | string;
  customUnit: "days" | "weeks" | "months";
  completion_target: number | string;
}

function computeFormDataFromInitial(
  initialData?: Partial<Activity> | null
): ActivityFormData {
  const defaults: ActivityFormData = {
    name: "",
    routine: "daily",
    weeklyDays: [],
    monthlyDay: 1,
    customInterval: 1,
    customUnit: "days",
    completion_target: 1,
  };
  if (!initialData) return defaults;

  const parsed = parseRoutine(initialData.routine || "daily");
  let baseRoutine = "daily";
  let weeklyDays: number[] = [];
  let monthlyDay = 1;
  let customInterval = 1;
  let customUnit: "days" | "weeks" | "months" = "days";

  switch (parsed.type) {
    case "weekly":
      baseRoutine = "weekly";
      weeklyDays = parsed.days;
      break;
    case "monthly":
      baseRoutine = "monthly";
      monthlyDay = parsed.day;
      break;
    case "custom":
      baseRoutine = "custom";
      customInterval = parsed.interval;
      customUnit = parsed.unit;
      break;
    case "daily":
    case "anytime":
    case "never":
      baseRoutine = parsed.type;
      break;
    case "unknown":
      baseRoutine = VALID_ROUTINES.includes(parsed.raw) ? parsed.raw : "daily";
      break;
  }

  return {
    name: initialData.name || "",
    routine: baseRoutine,
    weeklyDays,
    monthlyDay,
    customInterval,
    customUnit,
    completion_target: initialData.completion_target ?? 1,
  };
}

function buildRoutineConfig(formData: ActivityFormData) {
  if (formData.routine === "weekly" && formData.weeklyDays.length > 0) {
    return `weekly:${formData.weeklyDays.sort().join(",")}`;
  }
  if (formData.routine === "monthly") {
    return `monthly:${formData.monthlyDay}`;
  }
  if (formData.routine === "custom") {
    return `custom:${Math.max(1, parseInt(String(formData.customInterval)) || 1)}:${formData.customUnit}`;
  }
  return formData.routine;
}

export function ActivityDialogForm({
  open,
  onOpenChange,
  group,
  activity,
  onSaved,
}: ActivityDialogFormProps) {
  const isEditing = Boolean(activity);
  const [formData, setFormData] = useState<ActivityFormData>(() =>
    computeFormDataFromInitial(activity)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- intentionally re-initialize draft state on dialog open */
    setFormData(computeFormDataFromInitial(activity));
    setError(null);
    setSaving(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, activity]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setError(null);
      setSaving(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    const routineConfig = buildRoutineConfig(formData);
    const payload = {
      name: formData.name.trim(),
      routine: routineConfig,
      completion_target: Math.max(
        1,
        parseInt(String(formData.completion_target)) || 1
      ),
    };
    const validationError = validateActivityData(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditing && activity) {
        await db.activities.update(activity.id, {
          name: payload.name,
          routine: payload.routine,
          completion_target: payload.completion_target,
          updated_at: now(),
        });
      } else {
        const timestamp = now();
        await db.transaction("rw", db.activities, async () => {
          const shouldAssignOrderIndex = isScheduledRoutine(payload.routine);
          let nextOrderIndex: number | null = null;

          if (shouldAssignOrderIndex) {
            const scheduledActivities = await db.activities
              .filter(
                (item) =>
                  isActiveActivity(item) &&
                  isScheduledRoutine(item.routine ?? "")
              )
              .toArray();

            const maxOrderIndex = scheduledActivities.reduce(
              (max, item) =>
                typeof item.order_index === "number"
                  ? Math.max(max, item.order_index)
                  : max,
              -1
            );
            nextOrderIndex = maxOrderIndex + 1;
          }

          await db.activities.add({
            id: newId(),
            group_id: group.id,
            name: payload.name,
            routine: payload.routine,
            completion_target: payload.completion_target,
            is_archived: false,
            order_index: nextOrderIndex,
            created_at: timestamp,
            updated_at: timestamp,
            synced_at: null,
            deleted_at: null,
          });
        });
      }

      onSaved?.();
      handleOpenChange(false);
    } catch {
      setError(ERROR_MESSAGES.SAVE_ACTIVITY);
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={isEditing ? "Edit Activity" : "New Activity"}
      contentClassName="sm:max-w-md"
    >
      <FormStack>
        <FormField
          id="activity-name"
          label="Activity name"
          value={formData.name}
          onChange={(event) =>
            setFormData({ ...formData, name: event.target.value })
          }
          placeholder="e.g. Morning Exercise, Read Book"
          maxLength={80}
          autoFocus
        />

        <div className="space-y-2">
          <p className={dialogFieldLabelClassName}>Routine</p>
          <RoutineSelector
            routine={formData.routine}
            weeklyDays={formData.weeklyDays}
            customInterval={formData.customInterval}
            customUnit={formData.customUnit}
            onRoutineChange={(value) =>
              setFormData({ ...formData, routine: value })
            }
            onWeeklyDaysChange={(days) =>
              setFormData({ ...formData, weeklyDays: days })
            }
            onCustomIntervalChange={(interval) =>
              setFormData({ ...formData, customInterval: interval })
            }
            onCustomUnitChange={(unit) =>
              setFormData({ ...formData, customUnit: unit })
            }
          />
        </div>

        {isScheduledRoutine(formData.routine) ? (
          <FormField
            id="activity-completion-target"
            label="Completion target"
            type="number"
            min={1}
            max={100}
            value={formData.completion_target}
            onChange={(event) =>
              setFormData({
                ...formData,
                completion_target:
                  event.target.value === "" ? "" : parseInt(event.target.value),
              })
            }
            message="How many times you need to do this per day. 1 = simple checkbox."
          />
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <FormDialogActions
          onConfirm={handleSave}
          confirmLabel={
            saving
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save Changes"
                : "Create Activity"
          }
          confirmDisabled={saving || !formData.name.trim()}
          secondaryAction={{
            label: "Cancel",
            onClick: () => handleOpenChange(false),
            disabled: saving,
          }}
        />
      </FormStack>
    </FormDialog>
  );
}
