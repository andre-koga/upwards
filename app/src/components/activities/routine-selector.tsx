import {
  FormField,
  FormRow,
  FormSelectField,
  FormStack,
  FormToggleButton,
} from "@/components/forms";
import { dialogFieldLabelClassName } from "@/components/forms/styles";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDefaultRoutineOptions } from "@/components/activities/routine-selector-options";

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

interface RoutineSelectorProps {
  routine: string;
  weeklyDays: number[];
  monthlyDay?: number;
  customInterval: number | string;
  customUnit: "days" | "weeks" | "months";
  onRoutineChange: (routine: string) => void;
  onWeeklyDaysChange: (days: number[]) => void;
  onMonthlyDayChange?: (day: number) => void;
  onCustomIntervalChange: (interval: number | string) => void;
  onCustomUnitChange: (unit: "days" | "weeks" | "months") => void;
  options?: { value: string; label: string }[];
  trailingSlot?: ReactNode;
}

export default function RoutineSelector({
  routine,
  weeklyDays,
  monthlyDay = 1,
  customInterval,
  customUnit,
  onRoutineChange,
  onWeeklyDaysChange,
  onMonthlyDayChange,
  onCustomIntervalChange,
  onCustomUnitChange,
  options,
  trailingSlot,
}: RoutineSelectorProps) {
  const { t } = useTranslation("projects");
  const defaultOptions = useDefaultRoutineOptions();
  const resolvedOptions = options ?? defaultOptions;

  const weekdays = useMemo(
    () =>
      WEEKDAY_KEYS.map((key, index) => ({
        short: t(`routine.weekdays.${key}`).charAt(0),
        label: t(`routine.weekdays.${key}`),
        index,
      })),
    [t]
  );

  const toggleWeekday = (day: number) => {
    onWeeklyDaysChange(
      weeklyDays.includes(day)
        ? weeklyDays.filter((d) => d !== day)
        : [...weeklyDays, day]
    );
  };

  return (
    <FormStack className="space-y-0">
      <FormRow className="items-end gap-2">
        <FormSelectField
          id="activity-routine"
          label={t("routine.type")}
          labelClassName="sr-only"
          value={routine}
          onValueChange={onRoutineChange}
          options={resolvedOptions}
          containerClassName="min-w-0 flex-1 space-y-0"
        />
        {trailingSlot}
      </FormRow>

      {routine === "monthly" && onMonthlyDayChange && (
        <div className="space-y-1 pt-3">
          <p className={dialogFieldLabelClassName}>{t("routine.dayOfMonth")}</p>
          <FormField
            id="monthly-routine-day"
            label={t("routine.dayOfMonth")}
            labelClassName="sr-only"
            type="number"
            min="1"
            max="31"
            value={monthlyDay}
            onChange={(event) =>
              onMonthlyDayChange(
                Math.min(31, Math.max(1, parseInt(event.target.value) || 1))
              )
            }
            containerClassName="w-full space-y-0"
          />
        </div>
      )}

      {routine === "weekly" && (
        <div className="pt-3">
          <FormRow className="items-stretch gap-1">
            {weekdays.map((day) => (
              <FormToggleButton
                key={`${day.label}-${day.index}`}
                toggled={weeklyDays.includes(day.index)}
                onToggle={() => toggleWeekday(day.index)}
                label={t("routine.toggleDay", { day: day.label })}
                className="h-9 min-w-0 flex-1 rounded-md px-0 text-xs font-medium"
                activeClassName="border-primary bg-primary text-primary-foreground"
                inactiveClassName="border-input bg-background"
              >
                {day.short}
              </FormToggleButton>
            ))}
          </FormRow>
        </div>
      )}

      {routine === "custom" && (
        <div className="space-y-1 pt-3">
          <p className={dialogFieldLabelClassName}>{t("routine.every")}</p>
          <FormRow>
            <FormField
              id="custom-routine-interval"
              label={t("routine.customInterval")}
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
              label={t("routine.customUnit")}
              labelClassName="sr-only"
              value={customUnit}
              onValueChange={(value) =>
                onCustomUnitChange(value as "days" | "weeks" | "months")
              }
              options={[
                { value: "days", label: t("routine.days") },
                { value: "weeks", label: t("routine.weeks") },
                { value: "months", label: t("routine.months") },
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
