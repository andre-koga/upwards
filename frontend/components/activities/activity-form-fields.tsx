"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PATTERN_OPTIONS } from "@/lib/colors";
import { Tables } from "@/lib/supabase/types";

type Activity = Tables<"activities">;

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

  // Parse initial data
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

  const toggleWeekday = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      weeklyDays: prev.weeklyDays.includes(day)
        ? prev.weeklyDays.filter((d) => d !== day)
        : [...prev.weeklyDays, day],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build routine config string
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

      <div className="space-y-2">
        <Label htmlFor="routine">Routine</Label>
        <select
          id="routine"
          value={formData.routine}
          onChange={(e) =>
            setFormData({ ...formData, routine: e.target.value })
          }
          className="w-full px-3 py-2 border rounded-md bg-background"
        >
          <option value="anytime">Anytime (no schedule)</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom</option>
          <option value="never">Never (avoid this)</option>
        </select>

        {/* Weekly days selection */}
        {formData.routine === "weekly" && (
          <div className="mt-3 space-y-2">
            <Label className="text-sm">Select days:</Label>
            <div className="flex gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (day, index) => (
                  <Button
                    key={day}
                    type="button"
                    size="sm"
                    variant={
                      formData.weeklyDays.includes(index)
                        ? "default"
                        : "outline"
                    }
                    onClick={() => toggleWeekday(index)}
                    className="w-12"
                  >
                    {day}
                  </Button>
                ),
              )}
            </div>
          </div>
        )}

        {/* Monthly day selection */}
        {formData.routine === "monthly" && (
          <div className="mt-3 space-y-2">
            <Label htmlFor="monthlyDay" className="text-sm">
              Day of month:
            </Label>
            <Input
              id="monthlyDay"
              type="number"
              min="1"
              max="31"
              value={formData.monthlyDay}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  monthlyDay: parseInt(e.target.value) || 1,
                })
              }
              className="w-24"
            />
          </div>
        )}

        {/* Custom interval selection */}
        {formData.routine === "custom" && (
          <div className="mt-3 space-y-2">
            <Label className="text-sm">Every:</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="1"
                value={formData.customInterval}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customInterval:
                      e.target.value === "" ? "" : parseInt(e.target.value),
                  })
                }
                className="w-20"
              />
              <select
                value={formData.customUnit}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customUnit: e.target.value as "days" | "weeks" | "months",
                  })
                }
                className="px-3 py-2 border rounded-md flex-1 bg-background"
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>
        )}
      </div>

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
