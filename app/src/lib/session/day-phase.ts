export type DayPhase = "morning" | "day" | "evening";

/**
 * Resolves the default focus for the current effective day.
 *
 * The day-reset boundary belongs to the previous logical day until it
 * arrives, so the pre-reset window is part of the evening phase. A reset at
 * or after noon has no morning window and starts directly in the day phase.
 */
export function resolveDayPhase(now: Date, resetMinutes: number): DayPhase {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const normalizedReset = Math.max(0, Math.min(1440, Math.round(resetMinutes)));

  if (currentMinutes < normalizedReset) return "evening";
  if (normalizedReset >= 12 * 60 && currentMinutes < 17 * 60) {
    return "day";
  }
  if (currentMinutes < 12 * 60) return "morning";
  if (currentMinutes < 17 * 60) return "day";
  return "evening";
}
