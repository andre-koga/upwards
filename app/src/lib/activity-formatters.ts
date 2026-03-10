export type ParsedRoutine =
  | { type: "daily" }
  | { type: "anytime" }
  | { type: "never" }
  | { type: "weekly"; days: number[] }
  | { type: "monthly"; day: number }
  | { type: "custom"; interval: number; unit: "days" | "weeks" | "months" }
  | { type: "unknown"; raw: string };

/**
 * Parse a routine string into a structured format.
 */
export function parseRoutine(routine: string | null): ParsedRoutine {
  if (!routine || routine === "daily") return { type: "daily" };
  if (routine === "anytime") return { type: "anytime" };
  if (routine === "never") return { type: "never" };

  if (routine.startsWith("weekly:")) {
    const daysStr = routine.split(":")[1];
    const days = daysStr ? daysStr.split(",").map(Number) : [];
    return { type: "weekly", days };
  }
  if (routine.startsWith("monthly:")) {
    const day = parseInt(routine.split(":")[1]) || 1;
    return { type: "monthly", day };
  }
  if (routine.startsWith("custom:")) {
    const parts = routine.split(":");
    const interval = parseInt(parts[1]) || 1;
    const unit = (parts[2] as "days" | "weeks" | "months") || "days";
    return { type: "custom", interval, unit };
  }

  return { type: "unknown", raw: routine };
}

/**
 * Format milliseconds into a human-readable duration string.
 * e.g. 3661000 → "1h 1m 1s"
 */
export function formatActivityTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/**
 * Format milliseconds into a timer display string (MM:SS or HH:MM:SS).
 * Returns "MM:SS" by default, switches to "HH:MM:SS" when elapsed time >= 1 hour.
 * e.g. 65000 → "01:05", 3661000 → "01:01:01"
 */
export function formatTimerDisplay(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Convert a routine string to a human-readable label.
 * e.g. "weekly:1,3,5" → "Weekly: Mon, Wed, Fri"
 */
export function formatRoutineDisplay(routine: string | null): string {
  const parsed = parseRoutine(routine);
  switch (parsed.type) {
    case "daily":
      return "Daily";
    case "anytime":
      return "Anytime";
    case "never":
      return "Never";
    case "weekly": {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `Weekly: ${parsed.days.map((d) => dayNames[d]).join(", ")}`;
    }
    case "monthly":
      return `Monthly: Day ${parsed.day}`;
    case "custom":
      return `Every ${parsed.interval} ${parsed.unit}`;
    case "unknown":
      return parsed.raw.charAt(0).toUpperCase() + parsed.raw.slice(1);
  }
}
