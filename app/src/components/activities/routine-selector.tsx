import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <div className="space-y-0">
      <Select value={routine} onValueChange={onRoutineChange}>
        <SelectTrigger className="w-full rounded-full py-2.5 text-base border-border bg-muted/40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="anytime">Anytime (no schedule)</SelectItem>
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
          <SelectItem value="never">Never (avoid this)</SelectItem>
        </SelectContent>
      </Select>

      {routine === "weekly" && (
        <div className="pt-3">
          <div className="flex gap-2">
            {DAYS.map((day, index) => (
              <Button
                key={day}
                type="button"
                size="sm"
                variant={weeklyDays.includes(index) ? "default" : "outline"}
                onClick={() => toggleWeekday(index)}
                className="flex-1 rounded-full"
              >
                {day}
              </Button>
            ))}
          </div>
        </div>
      )}

      {routine === "monthly" && (
        <div className="pt-3 space-y-2">
          <p className="text-xs font-semibold">Day of month:</p>
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
        <div className="pt-3 space-y-2">
          <p className="text-xs font-semibold">Every:</p>
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
            <Select value={customUnit} onValueChange={onCustomUnitChange}>
              <SelectTrigger className="flex-1 rounded-full border-border bg-muted/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="weeks">Weeks</SelectItem>
                <SelectItem value="months">Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
