import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive } from "lucide-react";
import { ArchiveActivityDialog } from "@/components/activities/archive-activity-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  ACTIVITY_TYPES,
  activityTypeOfRoutine,
  habitRoutineOrDefault,
  normalizeActivityByType,
  type ActivityType,
} from "@/lib/activity/activity-type";
import { db, newId, now } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  isActivityArchived,
  isScheduledRoutine,
  validateActivityData,
} from "@/lib/activity";
import { cn } from "@/lib/utils";
import {
  buildRoutineString,
  computeRoutineFormFromString,
  type RoutineFormData,
} from "@/lib/activity/routine-form";
import { ERROR_MESSAGES } from "@/lib/error-utils";
import RoutineSelector from "@/components/activities/routine-selector";
import { useMemoRoutineOptions } from "@/components/activities/routine-selector-options";
import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormStack,
} from "@/components/forms";
import { dialogFieldLabelClassName } from "@/components/forms/styles";
import { patchActivity, saveActivity } from "@/lib/sync/mutate-synced";

interface ActivityDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ActivityGroup;
  activity?: Activity;
  onSaved?: () => void;
  /** Called after the activity is archived. */
  onArchived?: () => void;
}

interface ActivityFormData extends RoutineFormData {
  name: string;
  type: ActivityType;
  completion_target: number | string;
  tracks_time: boolean;
  is_pinned: boolean;
}

/** i18n key segment for each type (the type ids use a hyphen). */
const TYPE_KEY: Record<ActivityType, "habit" | "avoid" | "timeOnly"> = {
  habit: "habit",
  avoid: "avoid",
  "time-only": "timeOnly",
};

function computeFormDataFromInitial(
  initialData?: Partial<Activity> | null
): ActivityFormData {
  const type = activityTypeOfRoutine(initialData?.routine);
  // The schedule fields only describe a habit. For the other types they start
  // at the default so switching to Habit offers a sensible schedule.
  const routineForm = computeRoutineFormFromString(
    habitRoutineOrDefault(initialData?.routine)
  );
  return {
    name: initialData?.name || "",
    type,
    ...routineForm,
    completion_target: initialData?.completion_target ?? 1,
    tracks_time: initialData?.tracks_time !== false,
    is_pinned: initialData?.is_pinned === true,
  };
}

export function ActivityDialogForm({
  open,
  onOpenChange,
  group,
  activity,
  onSaved,
  onArchived,
}: ActivityDialogFormProps) {
  const { t } = useTranslation("projects");
  const habitRoutineOptions = useMemoRoutineOptions();
  const isEditing = Boolean(activity);
  const [formData, setFormData] = useState<ActivityFormData>(() =>
    computeFormDataFromInitial(activity)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- intentionally re-initialize draft state on dialog open */
    setFormData(computeFormDataFromInitial(activity));
    setError(null);
    setSaving(false);
    setArchiveConfirmOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, activity]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setArchiveConfirmOpen(false);
    if (!nextOpen) {
      setError(null);
      setSaving(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    // The type decides which fields apply, so a stale schedule or switch can't
    // leave a meaningless combination (e.g. a timed avoid habit).
    const payload = {
      name: formData.name.trim(),
      ...normalizeActivityByType({
        type: formData.type,
        habitRoutine: buildRoutineString(formData),
        target: formData.completion_target,
        tracksTime: formData.tracks_time,
        existingTarget: activity?.completion_target,
      }),
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
        await patchActivity(activity.id, {
          name: payload.name,
          routine: payload.routine,
          completion_target: payload.completion_target,
          tracks_time: payload.tracks_time,
          is_pinned: formData.is_pinned,
          updated_at: now(),
        });
      } else {
        const timestamp = now();
        const activityId = newId();
        const shouldAssignOrderIndex = isScheduledRoutine(payload.routine);
        let nextOrderIndex: number | null = null;

        if (shouldAssignOrderIndex) {
          const scheduledActivities = await db.activities
            .filter(
              (item) =>
                !isActivityArchived(item) &&
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

        await saveActivity({
          id: activityId,
          group_id: group.id,
          name: payload.name,
          routine: payload.routine,
          completion_target: payload.completion_target,
          archived_at: null,
          tracks_time: payload.tracks_time,
          is_pinned: formData.is_pinned,
          order_index: nextOrderIndex,
          created_at: timestamp,
          updated_at: timestamp,
          synced_at: null,
          deleted_at: null,
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
    <>
      <FormDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={
          isEditing ? t("activityForm.editTitle") : t("activityForm.newTitle")
        }
        headerEnd={
          isEditing && activity ? (
            <Button
              type="button"
              variant="destructiveOutline"
              size="iconRoundSm"
              className="shrink-0"
              disabled={saving}
              onClick={() => setArchiveConfirmOpen(true)}
              title={t("activityForm.archive")}
              aria-label={t("activityForm.archive")}
            >
              <Archive className="h-4 w-4" aria-hidden />
            </Button>
          ) : undefined
        }
        contentClassName="sm:max-w-md"
      >
        <FormStack>
          <FormField
            id="activity-name"
            label={t("activityForm.nameLabel")}
            value={formData.name}
            onChange={(event) =>
              setFormData({ ...formData, name: event.target.value })
            }
            placeholder={t("activityForm.namePlaceholder")}
            maxLength={80}
            autoFocus
          />

          <div className="space-y-2">
            <p id="activity-type-label" className={dialogFieldLabelClassName}>
              {t("activityForm.typeLabel")}
            </p>
            <RadioGroup
              aria-labelledby="activity-type-label"
              value={formData.type}
              onValueChange={(value) =>
                setFormData({ ...formData, type: value as ActivityType })
              }
            >
              {ACTIVITY_TYPES.map((type) => {
                const key = TYPE_KEY[type];
                const selected = formData.type === type;
                return (
                  <Label
                    key={type}
                    htmlFor={`activity-type-${type}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                      selected
                        ? "border-primary bg-sage/60"
                        : "border-border bg-muted/60 hover:bg-muted"
                    )}
                  >
                    <RadioGroupItem
                      id={`activity-type-${type}`}
                      value={type}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className="block text-sm font-medium leading-snug">
                        {t(`activityForm.types.${key}.label`)}
                      </span>
                      <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                        {t(`activityForm.types.${key}.description`)}
                      </span>
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>

          {formData.type === "habit" ? (
            <>
              <div className="space-y-2">
                <p className={dialogFieldLabelClassName}>
                  {t("activityForm.routineLabel")}
                </p>
                <RoutineSelector
                  routine={formData.routine}
                  weeklyDays={formData.weeklyDays}
                  monthlyDay={formData.monthlyDay}
                  customInterval={formData.customInterval}
                  customUnit={formData.customUnit}
                  options={habitRoutineOptions}
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

              <FormField
                id="activity-completion-target"
                label={t("activityForm.targetLabel")}
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
                message={t("activityForm.targetHint")}
              />

              <SwitchRow
                id="activity-tracks-time"
                label={t("activityForm.tracksTime.label")}
                hint={t("activityForm.tracksTime.hint")}
                checked={formData.tracks_time}
                onCheckedChange={(next) =>
                  setFormData({ ...formData, tracks_time: next })
                }
              />
            </>
          ) : null}

          <SwitchRow
            id="activity-pinned"
            label={t("activityForm.pin.label")}
            hint={t("activityForm.pin.hint")}
            checked={formData.is_pinned}
            onCheckedChange={(next) =>
              setFormData({ ...formData, is_pinned: next })
            }
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <FormDialogActions
            onConfirm={handleSave}
            confirmLabel={
              saving
                ? isEditing
                  ? t("activityForm.saving")
                  : t("activityForm.creating")
                : isEditing
                  ? t("activityForm.save")
                  : t("activityForm.create")
            }
            confirmDisabled={saving || !formData.name.trim()}
            secondaryAction={{
              label: t("activityForm.cancel"),
              onClick: () => handleOpenChange(false),
              disabled: saving,
            }}
          />
        </FormStack>
      </FormDialog>

      {isEditing && activity ? (
        <ArchiveActivityDialog
          open={open && archiveConfirmOpen}
          activityId={activity.id}
          activityName={activity.name}
          onOpenChange={setArchiveConfirmOpen}
          cancelLabel={t("activityForm.archiveNo")}
          confirmLabel={t("activityForm.archiveYes")}
          onArchived={() => {
            setArchiveConfirmOpen(false);
            onArchived?.();
            handleOpenChange(false);
          }}
        />
      ) : null}
    </>
  );
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="leading-snug">
          {label}
        </Label>
        <p
          id={`${id}-hint`}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {hint}
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-hint`}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
