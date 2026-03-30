import {
  FormField,
  FormRow,
  FormSelectField,
  FormStack,
  FormToggleButton,
} from "@/components/forms";
import { dialogFieldLabelClassName } from "@/components/forms/styles";

const DAYS = [
  { short: "S", label: "Sunday" },
  { short: "M", label: "Monday" },
  { short: "T", label: "Tuesday" },
  { short: "W", label: "Wednesday" },
  { short: "T", label: "Thursday" },
  { short: "F", label: "Friday" },
  { short: "S", label: "Saturday" },
];

interface RoutineSelectorProps {
  routine: string;
  weeklyDays: number[];
  customInterval: number | string;
  customUnit: "days" | "weeks" | "months";
  onRoutineChange: (routine: string) => void;
  onWeeklyDaysChange: (days: number[]) => void;
  onCustomIntervalChange: (interval: number | string) => void;
  onCustomUnitChange: (unit: "days" | "weeks" | "months") => void;
}

export default function RoutineSelector({
  routine,
  weeklyDays,
  customInterval,
  customUnit,
  onRoutineChange,
  onWeeklyDaysChange,
  onCustomIntervalChange,
  onCustomUnitChange,
}: RoutineSelectorProps) {
  const toggleWeekday = (day: number) => {
    onWeeklyDaysChange(
      weeklyDays.includes(day)
        ? weeklyDays.filter((d) => d !== day)
        : [...weeklyDays, day]
    );
  };

  return (
    <FormStack className="space-y-0">
      <FormSelectField
        id="activity-routine"
        label="Routine type"
        labelClassName="sr-only"
        value={routine}
        onValueChange={onRoutineChange}
        options={[
          { value: "anytime", label: "Anytime (no schedule)" },
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "custom", label: "Custom" },
          { value: "never", label: "Never (avoid this)" },
        ]}
        containerClassName="space-y-0"
      />

      {routine === "weekly" && (
        <div className="pt-3">
          <FormRow className="items-stretch gap-1">
            {DAYS.map((day, index) => (
              <FormToggleButton
                key={`${day.label}-${index}`}
                toggled={weeklyDays.includes(index)}
                onToggle={() => toggleWeekday(index)}
                label={`Toggle ${day.label}`}
                className="h-9 min-w-0 flex-1 rounded-md px-0 text-xs font-medium"
                activeClassName="border-primary bg-primary text-primary-foreground"
                inactiveClassName="border-input bg-background hover:bg-accent hover:text-accent-foreground"
              >
                {day.short}
              </FormToggleButton>
            ))}
          </FormRow>
        </div>
      )}

      {routine === "custom" && (
        <div className="space-y-1 pt-3">
          <p className={dialogFieldLabelClassName}>Every</p>
          <FormRow>
            <FormField
              id="custom-routine-interval"
              label="Custom interval"
              labelClassName="sr-only"
              type="number"
              min="1"
              value={customInterval}
              onChange={(event) =>
                onCustomIntervalChange(
                  event.target.value === "" ? "" : parseInt(event.target.value)
                )
              }
              containerClassName="w-20 space-y-0"
            />
            <FormSelectField
              id="custom-routine-unit"
              label="Custom unit"
              labelClassName="sr-only"
              value={customUnit}
              onValueChange={(value) =>
                onCustomUnitChange(value as "days" | "weeks" | "months")
              }
              options={[
                { value: "days", label: "Days" },
                { value: "weeks", label: "Weeks" },
                { value: "months", label: "Months" },
              ]}
              containerClassName="flex-1 space-y-0"
              triggerClassName="h-10"
            />
          </FormRow>
        </div>
      )}
    </FormStack>
  );
}
