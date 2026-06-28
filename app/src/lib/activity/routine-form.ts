import { parseRoutine } from "./utils";

const VALID_ROUTINES = ["anytime", "daily", "weekly", "monthly", "custom", "never"];

export interface RoutineFormData {
  routine: string;
  weeklyDays: number[];
  monthlyDay: number;
  customInterval: number | string;
  customUnit: "days" | "weeks" | "months";
}

export const DEFAULT_ROUTINE_FORM: RoutineFormData = {
  routine: "daily",
  weeklyDays: [],
  monthlyDay: 1,
  customInterval: 1,
  customUnit: "days",
};

export function computeRoutineFormFromString(
  routine: string | null | undefined
): RoutineFormData {
  const parsed = parseRoutine(routine || "daily");
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
      baseRoutine = VALID_ROUTINES.includes(parsed.raw) ? parsed.raw : "daily";
      break;
  }

  return {
    routine: baseRoutine,
    weeklyDays,
    monthlyDay,
    customInterval,
    customUnit,
  };
}

export function buildRoutineString(formData: RoutineFormData): string {
  if (formData.routine === "weekly" && formData.weeklyDays.length > 0) {
    return `weekly:${[...formData.weeklyDays].sort((a, b) => a - b).join(",")}`;
  }
  if (formData.routine === "monthly") {
    return `monthly:${formData.monthlyDay}`;
  }
  if (formData.routine === "custom") {
    return `custom:${Math.max(1, parseInt(String(formData.customInterval)) || 1)}:${formData.customUnit}`;
  }
  return formData.routine;
}
