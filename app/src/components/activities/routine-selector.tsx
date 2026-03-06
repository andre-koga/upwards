import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface RoutineSelectorProps {
  routine: string;
  weeklyDays: number[];
  monthlyDay: number;
  customInterval: number | string;
  customUnit: "days" | "weeks" | "months";
  onRoutineChange: (routine: string) => void;
  onWeeklyDaysChange: (days: number[]) => void;
  onMonthlyDayChange: (day: number) => void;
  onCustomIntervalChange: (interval: number | string) => void;
  onCustomUnitChange: (unit: "days" | "weeks" | "months") => void;
}

export default function RoutineSelector({
  routine,
  weeklyDays,
  monthlyDay,
  customInterval,
  customUnit,
  onRoutineChange,
  onWeeklyDaysChange,
  onMonthlyDayChange,
  onCustomIntervalChange,
  onCustomUnitChange,
}: RoutineSelectorProps) {
  const toggleWeekday = (day: number) => {
    onWeeklyDaysChange(
      weeklyDays.includes(day)
        ? weeklyDays.filter((d) => d !== day)
        : [...weeklyDays, day],
    );
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="routine">Routine</Label>
      <select
        id="routine"
        value={routine}
        onChange={(e) => onRoutineChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-md bg-background"
      >
        <option value="anytime">Anytime (no schedule)</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Custom</option>
        <option value="never">Never (avoid this)</option>
      </select>

      {routine === "weekly" && (
        <div className="mt-3 space-y-2">
          <Label className="text-sm">Select days:</Label>
          <div className="flex gap-2">
            {DAYS.map((day, index) => (
              <Button
                key={day}
                type="button"
                size="sm"
                variant={weeklyDays.includes(index) ? "default" : "outline"}
                onClick={() => toggleWeekday(index)}
                className="w-12"
              >
                {day}
              </Button>
            ))}
          </div>
        </div>
      )}

      {routine === "monthly" && (
        <div className="mt-3 space-y-2">
          <Label htmlFor="monthlyDay" className="text-sm">
            Day of month:
          </Label>
          <Input
            id="monthlyDay"
            type="number"
            min="1"
            max="31"
            value={monthlyDay}
            onChange={(e) => onMonthlyDayChange(parseInt(e.target.value) || 1)}
            className="w-24"
          />
        </div>
      )}

      {routine === "custom" && (
        <div className="mt-3 space-y-2">
          <Label className="text-sm">Every:</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min="1"
              value={customInterval}
              onChange={(e) =>
                onCustomIntervalChange(
                  e.target.value === "" ? "" : parseInt(e.target.value),
                )
              }
              className="w-20"
            />
            <select
              value={customUnit}
              onChange={(e) =>
                onCustomUnitChange(
                  e.target.value as "days" | "weeks" | "months",
                )
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
  );
}
