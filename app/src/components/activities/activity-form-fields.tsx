import { useState, useEffect } from "react";
import RoutineSelector from "@/components/activities/routine-selector";
import ActivityPill from "@/components/activities/activity-pill";
import FormPageLayout from "@/components/ui/form-page-layout";
import { parseRoutine, isScheduledRoutine } from "@/lib/activity-utils";
import { formSectionLabel, formInput } from "@/lib/form-styles";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";

interface ActivityFormFieldsProps {
  group: ActivityGroup;
  initialData?: Partial<Activity>;
  onSubmit: (data: {
    name: string;
    routine: string;
    completion_target: number;
  }) => Promise<void>;
  submitLabel: string;
  isSubmitting: boolean;
  error?: string | null;
  backPath?: string;
}

interface FormData {
  name: string;
  routine: string;
  weeklyDays: number[];
  monthlyDay: number;
  customInterval: number | string;
  customUnit: "days" | "weeks" | "months";
  completion_target: number | string;
}

export default function ActivityFormFields({
  group,
  initialData,
  onSubmit,
  submitLabel,
  isSubmitting,
  error,
  backPath,
}: ActivityFormFieldsProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    routine: "daily",
    weeklyDays: [],
    monthlyDay: 1,
    customInterval: 1,
    customUnit: "days",
    completion_target: 1,
  });

  useEffect(() => {
    if (!initialData) return;

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
        baseRoutine = parsed.raw;
        break;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      name: initialData.name || "",
      routine: baseRoutine,
      weeklyDays,
      monthlyDay,
      customInterval,
      customUnit,
      completion_target: initialData.completion_target ?? 1,
    });
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let routineConfig = formData.routine;
    if (formData.routine === "weekly" && formData.weeklyDays.length > 0) {
      routineConfig = `weekly:${formData.weeklyDays.sort().join(",")}`;
    } else if (formData.routine === "monthly") {
      routineConfig = `monthly:${formData.monthlyDay}`;
    } else if (formData.routine === "custom") {
      routineConfig = `custom:${Math.max(1, parseInt(String(formData.customInterval)) || 1)}:${formData.customUnit}`;
    }

    await onSubmit({
      name: formData.name.trim(),
      routine: routineConfig,
      completion_target: Math.max(
        1,
        parseInt(String(formData.completion_target)) || 1
      ),
    });
  };

  return (
    <FormPageLayout
      formId="activity-form"
      onSubmit={handleSubmit}
      backPath={backPath || "/"}
      submitLabel={submitLabel}
      isSubmitting={isSubmitting}
      submitDisabled={!formData.name.trim()}
      error={error}
    >
      {/* Preview — centered in available top space */}
      <div className="flex flex-1 flex-col justify-center gap-3">
        <p className={formSectionLabel}>Preview</p>
        <ActivityPill
          name={formData.name}
          color={group.color || DEFAULT_GROUP_COLOR}
          readOnly
        />
      </div>

      <hr className="-mx-4 -mb-2 border-border" />

      {/* Activity name */}
      <div className="space-y-3">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Activity Name
        </p>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder="e.g. Morning Exercise, Read Book"
          className={formInput}
          required
        />
      </div>

      {/* Routine selector */}
      <div className="space-y-3">
        <p className={formSectionLabel}>Routine</p>
        <RoutineSelector
          routine={formData.routine}
          weeklyDays={formData.weeklyDays}
          monthlyDay={formData.monthlyDay}
          customInterval={formData.customInterval}
          customUnit={formData.customUnit}
          onRoutineChange={(val) => setFormData({ ...formData, routine: val })}
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

      {/* Completion target — only show if routine has a schedule */}
      {isScheduledRoutine(formData.routine) && (
        <div className="space-y-3">
          <p className={formSectionLabel}>Completion Target</p>
          <p className="text-center text-xs text-muted-foreground">
            How many times you need to do this per day. 1 = simple checkbox.
          </p>
          <input
            id="completion_target"
            type="number"
            min="1"
            max="100"
            value={formData.completion_target}
            onChange={(e) =>
              setFormData({
                ...formData,
                completion_target:
                  e.target.value === "" ? "" : parseInt(e.target.value),
              })
            }
            className="mx-auto block h-10 w-24 rounded-full border border-border bg-muted/40 px-4 text-base transition-colors placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      )}
    </FormPageLayout>
  );
}
