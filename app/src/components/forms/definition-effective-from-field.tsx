import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormCalendarDateField, FormSelectField } from "@/components/forms";
import { getEffectiveToday } from "@/lib/session/day-reset";

export type DefinitionEffectiveFromMode = "today" | "beginning" | "custom";

export function resolveDefinitionEffectiveFrom(
  mode: DefinitionEffectiveFromMode,
  options: {
    beginningDate: string;
    customDate: string;
    today?: string;
  }
): string {
  const today = options.today ?? getEffectiveToday();
  switch (mode) {
    case "today":
      return today;
    case "beginning":
      return options.beginningDate;
    case "custom":
      return options.customDate || today;
  }
}

export function beginningLogicalDayFromCreatedAt(createdAt: string): string {
  return getEffectiveToday(new Date(createdAt));
}

export interface DefinitionEffectiveFromFieldProps {
  idPrefix: string;
  createdAt: string;
  variant: "activity" | "group";
  mode: DefinitionEffectiveFromMode;
  onModeChange: (mode: DefinitionEffectiveFromMode) => void;
  customDate: string;
  onCustomDateChange: (date: string) => void;
  disabled?: boolean;
}

export function DefinitionEffectiveFromField({
  idPrefix,
  createdAt,
  variant,
  mode,
  onModeChange,
  customDate,
  onCustomDateChange,
  disabled = false,
}: DefinitionEffectiveFromFieldProps) {
  const { t } = useTranslation("projects");
  const beginningDate = useMemo(
    () => beginningLogicalDayFromCreatedAt(createdAt),
    [createdAt]
  );
  const today = useMemo(() => getEffectiveToday(), []);

  const label =
    variant === "activity"
      ? t("definitionEffectiveFrom.labelSchedule")
      : t("definitionEffectiveFrom.labelSettings");

  const options = useMemo(
    () => [
      { value: "today", label: t("definitionEffectiveFrom.today") },
      {
        value: "beginning",
        label: t("definitionEffectiveFrom.beginning"),
      },
      { value: "custom", label: t("definitionEffectiveFrom.custom") },
    ],
    [t]
  );

  return (
    <div className="space-y-2">
      <FormSelectField
        id={`${idPrefix}-effective-from-mode`}
        label={label}
        value={mode}
        onValueChange={(value) =>
          onModeChange(value as DefinitionEffectiveFromMode)
        }
        options={options}
        disabled={disabled}
        message={t("definitionEffectiveFrom.helper")}
      />

      {mode === "custom" ? (
        <FormCalendarDateField
          id={`${idPrefix}-effective-from-date`}
          label={t("definitionEffectiveFrom.customDate")}
          value={customDate}
          onValueChange={onCustomDateChange}
          min={beginningDate}
          max={today}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

export interface DefinitionEffectiveFromState {
  mode: DefinitionEffectiveFromMode;
  customDate: string;
}

export function useDefinitionEffectiveFromState(
  createdAt: string,
  resetKey?: string
): {
  state: DefinitionEffectiveFromState;
  setMode: (mode: DefinitionEffectiveFromMode) => void;
  setCustomDate: (date: string) => void;
  effectiveFrom: string;
} {
  const beginningDate = useMemo(
    () => beginningLogicalDayFromCreatedAt(createdAt),
    [createdAt]
  );
  const today = useMemo(() => getEffectiveToday(), []);

  const [mode, setMode] = useState<DefinitionEffectiveFromMode>("today");
  const [customDate, setCustomDate] = useState(today);

  useEffect(() => {
    setMode("today");
    setCustomDate(getEffectiveToday());
  }, [createdAt, resetKey]);

  const effectiveFrom = useMemo(
    () =>
      resolveDefinitionEffectiveFrom(mode, {
        beginningDate,
        customDate,
        today,
      }),
    [mode, beginningDate, customDate, today]
  );

  return {
    state: { mode, customDate },
    setMode,
    setCustomDate,
    effectiveFrom,
  };
}
