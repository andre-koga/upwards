import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive } from "lucide-react";
import { ArchiveActivityDialog } from "@/components/activities/archive-activity-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { resolveTracksTime, trackTimeRule } from "@/lib/activity/tracks-time";
import { db, newId, now } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  isActivityArchived,
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
  completion_target: number | string;
  tracks_time: boolean;
}

function computeFormDataFromInitial(
  initialData?: Partial<Activity> | null
): ActivityFormData {
  const routineForm = computeRoutineFormFromString(initialData?.routine);
  return {
    name: initialData?.name || "",
    ...routineForm,
    completion_target: initialData?.completion_target ?? 1,
    tracks_time: initialData?.tracks_time !== false,
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
    const routineConfig = buildRoutineString(formData);
    const payload = {
      name: formData.name.trim(),
      routine: routineConfig,
      completion_target: Math.max(
        1,
        parseInt(String(formData.completion_target)) || 1
      ),
      // The routine decides when the switch cannot (avoid habits are never
      // timed; time-only activities always are), so a stale switch can't leave
      // a meaningless combination.
      tracks_time: resolveTracksTime(routineConfig, formData.tracks_time),
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
          is_archived: false,
          completed_at: null,
          archived_at: null,
          tracks_time: payload.tracks_time,
          is_pinned: false,
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
        title={isEditing ? "Edit Activity" : "New Activity"}
        headerEnd={
          isEditing && activity ? (
            <Button
              type="button"
              variant="destructiveOutline"
              size="iconRoundSm"
              className="shrink-0"
              disabled={saving}
              onClick={() => setArchiveConfirmOpen(true)}
              title="Archive activity"
              aria-label="Archive activity"
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

          {trackTimeRule(buildRoutineString(formData)).canChoose ? (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <Label htmlFor="activity-tracks-time" className="leading-snug">
                  {t("activityForm.tracksTime.label")}
                </Label>
                <p
                  id="activity-tracks-time-hint"
                  className="text-xs leading-relaxed text-muted-foreground"
                >
                  {t("activityForm.tracksTime.hint")}
                </p>
              </div>
              <Switch
                id="activity-tracks-time"
                aria-describedby="activity-tracks-time-hint"
                checked={formData.tracks_time}
                onCheckedChange={(next) =>
                  setFormData({ ...formData, tracks_time: next })
                }
              />
            </div>
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
        <ArchiveActivityDialog
          open={open && archiveConfirmOpen}
          activityId={activity.id}
          activityName={activity.name}
          onOpenChange={setArchiveConfirmOpen}
          cancelLabel="No"
          confirmLabel="Yes"
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
