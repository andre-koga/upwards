import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PATTERN_OPTIONS } from "@/lib/colors";
import RoutineSelector from "@/components/activities/routine-selector";
import type { Activity } from "@/lib/db/types";

interface ActivityFormFieldsProps {
  initialData?: Partial<Activity>;
  onSubmit: (data: {
    name: string;
    pattern: string;
    routine: string;
    completion_target: number;
  }) => void;
  onCancel: () => void;
  submitLabel: string;
  isSubmitting: boolean;
  error?: string | null;
}

interface FormData {
  name: string;
  pattern: string;
  routine: string;
  weeklyDays: number[];
  monthlyDay: number;
  customInterval: number | string;
  customUnit: "days" | "weeks" | "months";
  completion_target: number | string;
}

export default function ActivityFormFields({
  initialData,
  onSubmit,
  onCancel,
  submitLabel,
  isSubmitting,
  error,
}: ActivityFormFieldsProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    pattern: "solid",
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
      pattern: initialData.pattern || "solid",
      routine: baseRoutine,
      weeklyDays,
      monthlyDay,
      customInterval,
      customUnit,
      completion_target: initialData.completion_target ?? 1,
    });
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let routineConfig = formData.routine;
    if (formData.routine === "weekly" && formData.weeklyDays.length > 0) {
      routineConfig = `weekly:${formData.weeklyDays.sort().join(",")}`;
    } else if (formData.routine === "monthly") {
      routineConfig = `monthly:${formData.monthlyDay}`;
    } else if (formData.routine === "custom") {
      routineConfig = `custom:${Math.max(1, parseInt(String(formData.customInterval)) || 1)}:${formData.customUnit}`;
    }

    onSubmit({
      name: formData.name.trim(),
      pattern: formData.pattern,
      routine: routineConfig,
      completion_target: Math.max(
        1,
        parseInt(String(formData.completion_target)) || 1,
      ),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Activity Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Morning Exercise, Read Book"
          required
        />
      </div>

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

      <div className="space-y-2">
        <Label htmlFor="completion_target">Completion target</Label>
        <p className="text-xs text-muted-foreground">
          How many times you need to do this per day. 1 = simple checkbox.
        </p>
        <Input
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
          className="w-24"
        />
      </div>

      <div className="space-y-2">
        <Label>Pattern</Label>
        <div className="grid grid-cols-3 gap-2">
          {PATTERN_OPTIONS.map((pattern) => (
            <button
              key={pattern.value}
              type="button"
              onClick={() =>
                setFormData({ ...formData, pattern: pattern.value })
              }
              className={`px-3 py-2 rounded-md border-2 transition-all text-sm ${
                formData.pattern === pattern.value
                  ? "border-primary bg-primary/10 font-semibold"
                  : "border-muted hover:border-muted-foreground"
              }`}
            >
              {pattern.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
