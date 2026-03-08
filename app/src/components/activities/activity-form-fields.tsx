import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import RoutineSelector from "@/components/activities/routine-selector";
import ActivityPill from "@/components/activities/activity-pill";
import type { Activity, ActivityGroup } from "@/lib/db/types";

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
  const navigate = useNavigate();
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

    const routine = initialData.routine || "daily";
    let baseRoutine = routine;
    let weeklyDays: number[] = [];
    let monthlyDay = 1;
    let customInterval = 1;
    let customUnit: "days" | "weeks" | "months" = "days";

    if (routine.startsWith("weekly:")) {
      baseRoutine = "weekly";
      const days = routine.split(":")[1];
      weeklyDays = days ? days.split(",").map(Number) : [];
    } else if (routine.startsWith("monthly:")) {
      baseRoutine = "monthly";
      monthlyDay = parseInt(routine.split(":")[1]) || 1;
    } else if (routine.startsWith("custom:")) {
      baseRoutine = "custom";
      const parts = routine.split(":");
      customInterval = parseInt(parts[1]) || 1;
      customUnit = (parts[2] as "days" | "weeks" | "months") || "days";
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
        parseInt(String(formData.completion_target)) || 1,
      ),
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <form
        id="activity-form"
        onSubmit={handleSubmit}
        className="flex flex-col flex-1 px-4 pt-0 pb-28 gap-8"
      >
        {/* Preview — centered in available top space */}
        <div className="flex-1 flex flex-col justify-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">
            Preview
          </p>
          <ActivityPill
            name={formData.name}
            color={group.color || "#888"}
            readOnly
          />
        </div>

        <hr className="border-border -mx-4 -mb-2" />

        {/* Activity name */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">
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
            className="w-full h-10 bg-muted/40 border border-border rounded-full px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors placeholder:text-muted-foreground/50"
            required
          />
        </div>

        {/* Routine selector */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">
            Routine
          </p>
          <RoutineSelector
            routine={formData.routine}
            weeklyDays={formData.weeklyDays}
            monthlyDay={formData.monthlyDay}
            customInterval={formData.customInterval}
            customUnit={formData.customUnit}
            onRoutineChange={(val) =>
              setFormData({ ...formData, routine: val })
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

        {/* Completion target — only show if routine has a schedule */}
        {formData.routine !== "anytime" && formData.routine !== "never" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">
              Completion Target
            </p>
            <p className="text-xs text-muted-foreground text-center">
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
              className="mx-auto block h-10 bg-muted/40 border border-border rounded-full px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors placeholder:text-muted-foreground/50 w-24"
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {/* Fixed bottom — back button left, submit pill center */}
      <button
        type="button"
        onClick={() => navigate(backPath || "/")}
        className="fixed bottom-6 left-6 z-50 h-10 w-10 border border-border flex items-center justify-center rounded-full bg-background shadow-md text-muted-foreground hover:text-foreground transition-colors"
        title="Back"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          type="submit"
          form="activity-form"
          disabled={isSubmitting || !formData.name.trim()}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full shadow-lg px-5 py-2.5 font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
