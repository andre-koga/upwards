import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/activities/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { db, newId, now } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  appendActivityDefinitionVersion,
  isScheduledRoutine,
  validateActivityData,
} from "@/lib/activity";
import {
  buildRoutineString,
  computeRoutineFormFromString,
  type RoutineFormData,
} from "@/lib/activity/routine-form";
import { ERROR_MESSAGES } from "@/lib/error-utils";
import RoutineSelector from "@/components/activities/routine-selector";
import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormStack,
  DefinitionEffectiveFromField,
  useDefinitionEffectiveFromState,
} from "@/components/forms";
import { dialogFieldLabelClassName } from "@/components/forms/styles";

interface ActivityDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ActivityGroup;
  activity?: Activity;
  onSaved?: () => void;
  /** Called after the activity is permanently deleted. */
  onDeleted?: () => void;
}

interface ActivityFormData extends RoutineFormData {
  name: string;
  completion_target: number | string;
}

function computeFormDataFromInitial(
  initialData?: Partial<Activity> | null
): ActivityFormData {
  const routineForm = computeRoutineFormFromString(initialData?.routine);
  return {
    name: initialData?.name || "",
    ...routineForm,
    completion_target: initialData?.completion_target ?? 1,
  };
}

export function ActivityDialogForm({
  open,
  onOpenChange,
  group,
  activity,
  onSaved,
  onDeleted,
}: ActivityDialogFormProps) {
  const isEditing = Boolean(activity);
  const [formData, setFormData] = useState<ActivityFormData>(() =>
    computeFormDataFromInitial(activity)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const effectiveFromControl = useDefinitionEffectiveFromState(
    activity?.created_at ?? "",
    open && activity ? activity.id : undefined
  );

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- intentionally re-initialize draft state on dialog open */
    setFormData(computeFormDataFromInitial(activity));
    setError(null);
    setSaving(false);
    setDeleteConfirmOpen(false);
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
    const routineConfig = buildRoutineString(formData);
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
        const updated: Activity = {
          ...activity,
          name: payload.name,
          routine: payload.routine,
          completion_target: payload.completion_target,
          updated_at: now(),
        };
        await db.activities.update(activity.id, {
          name: updated.name,
          routine: updated.routine,
          completion_target: updated.completion_target,
          updated_at: updated.updated_at,
        });
        await appendActivityDefinitionVersion({
          activity: updated,
          effectiveFrom: effectiveFromControl.effectiveFrom,
        });
      } else {
        const timestamp = now();
        const activityId = newId();
        let createdActivity: Activity | null = null;
        await db.transaction("rw", db.activities, async () => {
          const shouldAssignOrderIndex = isScheduledRoutine(payload.routine);
          let nextOrderIndex: number | null = null;

          if (shouldAssignOrderIndex) {
            const scheduledActivities = await db.activities
              .filter(
                (item) =>
                  !item.completed_at &&
                  !item.deleted_at &&
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

          createdActivity = {
            id: activityId,
            group_id: group.id,
            name: payload.name,
            routine: payload.routine,
            completion_target: payload.completion_target,
            completed_at: null,
            order_index: nextOrderIndex,
            created_at: timestamp,
            updated_at: timestamp,
            synced_at: null,
            deleted_at: null,
          };
          await db.activities.add(createdActivity);
        });
        if (createdActivity) {
          await appendActivityDefinitionVersion({
            activity: createdActivity,
            force: true,
          });
        }
      }

      onSaved?.();
      handleOpenChange(false);
    } catch {
      setError(ERROR_MESSAGES.SAVE_ACTIVITY);
      setSaving(false);
    }
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={isEditing ? "Edit Activity" : "New Activity"}
        headerEnd={
          isEditing && activity ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full border-destructive text-destructive"
              disabled={saving}
              onClick={() => setDeleteConfirmOpen(true)}
              title="Delete activity"
              aria-label="Delete activity"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          ) : undefined
        }
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
              monthlyDay={formData.monthlyDay}
              customInterval={formData.customInterval}
              customUnit={formData.customUnit}
              onRoutineChange={(value) =>
                setFormData({ ...formData, routine: value })
              }
              onWeeklyDaysChange={(days) =>
                setFormData({ ...formData, weeklyDays: days })
              }
              onMonthlyDayChange={(day) =>
                setFormData({ ...formData, monthlyDay: day })
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
                    event.target.value === ""
                      ? ""
                      : parseInt(event.target.value),
                })
              }
              message="How many times you need to do this per day. 1 = simple checkbox."
            />
          ) : null}

          {isEditing && activity ? (
            <DefinitionEffectiveFromField
              idPrefix="activity-definition"
              createdAt={activity.created_at}
              variant="activity"
              mode={effectiveFromControl.state.mode}
              onModeChange={effectiveFromControl.setMode}
              customDate={effectiveFromControl.state.customDate}
              onCustomDateChange={effectiveFromControl.setCustomDate}
              disabled={saving}
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

      {isEditing && activity ? (
        <DeleteConfirmDialog
          open={open && deleteConfirmOpen}
          type="activity"
          id={activity.id}
          onOpenChange={setDeleteConfirmOpen}
          onDeleted={() => {
            setDeleteConfirmOpen(false);
            onDeleted?.();
            handleOpenChange(false);
          }}
        />
      ) : null}
    </>
  );
}
