import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export function useDefaultRoutineOptions() {
  const { t } = useTranslation("projects");

  return useMemo(
    () => [
      { value: "anytime", label: t("routine.anytime") },
      { value: "daily", label: t("routine.daily") },
      { value: "weekly", label: t("routine.weekly") },
      { value: "custom", label: t("routine.custom") },
      { value: "never", label: t("routine.never") },
    ],
    [t]
  );
}

export function useMemoRoutineOptions() {
  const { t } = useTranslation("projects");

  return useMemo(
    () => [
      { value: "daily", label: t("routine.daily") },
      { value: "weekly", label: t("routine.weekly") },
      { value: "monthly", label: t("routine.monthly") },
      { value: "custom", label: t("routine.custom") },
    ],
    [t]
  );
}

/** @deprecated Use useMemoRoutineOptions() inside a component. */
export const MEMO_ROUTINE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];
