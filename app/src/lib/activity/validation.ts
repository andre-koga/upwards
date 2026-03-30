import { parseRoutine } from "./utils";

export interface ActivitySubmitData {
  name: string;
  routine: string;
  completion_target: number;
}

/**
 * Validate activity form data. Returns error message or null if valid.
 */
export function validateActivityData(data: ActivitySubmitData): string | null {
  if (!data.name.trim()) return "Activity name is required";
  const parsed = parseRoutine(data.routine);
  if (parsed.type === "weekly" && parsed.days.length === 0) {
    return "Please select at least one day for weekly routine";
  }
  return null;
}
