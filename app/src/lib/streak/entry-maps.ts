import type { DailyEntry } from "@/lib/db/types";

export function buildBreakDaysSet(entries: DailyEntry[]): Set<string> {
  const breakDays = new Set<string>();
  for (const e of entries) {
    if (e.is_break_day) breakDays.add(e.date);
  }
  return breakDays;
}

export function buildEntriesByDateMap(
  entries: DailyEntry[]
): Map<string, DailyEntry> {
  const map = new Map<string, DailyEntry>();
  for (const e of entries) map.set(e.date, e);
  return map;
}
