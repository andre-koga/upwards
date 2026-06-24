import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import { effectiveDateForMs } from "@/lib/activity/period-day-utils";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";
import {
  computeCompletionTotals,
  completionRate,
  getToday,
} from "./completion";
import type { HeatmapDay, MonthlyCompletionPoint } from "./types";

export function sumTimerMsByDate(
  periods: ActivityPeriod[],
  nowMs = Date.now(),
): Record<string, number> {
  const timerByDate: Record<string, number> = {};
  for (const p of periods) {
    if (p.deleted_at) continue;
    const startMs = new Date(p.start_time).getTime();
    const endMs = p.end_time ? new Date(p.end_time).getTime() : nowMs;
    const durationMs = Math.max(0, endMs - startMs);
    const dateStr = effectiveDateForMs(startMs);
    timerByDate[dateStr] = (timerByDate[dateStr] ?? 0) + durationMs;
  }
  return timerByDate;
}

export function sumTimerMsInRange(
  timerByDate: Record<string, number>,
  fromDate: Date,
  toDate: Date,
): number {
  let total = 0;
  let cur = fromDate;
  while (cur <= toDate) {
    total += timerByDate[toDateString(cur)] ?? 0;
    cur = shiftDate(cur, 1);
  }
  return total;
}

const TIME_OF_DAY_WINDOW_DAYS = 30;

/** Total tracked ms per clock hour (0–23) over the last 30 days. */
export function buildTimeOfDayBuckets(periods: ActivityPeriod[]): number[] {
  const today = getToday();
  const fromDate = shiftDate(today, -(TIME_OF_DAY_WINDOW_DAYS - 1));
  const fromMs = startOfDay(fromDate).getTime();
  const toMs = startOfDay(shiftDate(today, 1)).getTime();

  const buckets = Array.from({ length: 24 }, () => 0);
  for (const p of periods) {
    if (p.deleted_at || !p.end_time) continue;
    const startMs = new Date(p.start_time).getTime();
    const endMs = new Date(p.end_time).getTime();
    if (endMs <= startMs) continue;

    let cursor = Math.max(startMs, fromMs);
    const cappedEnd = Math.min(endMs, toMs);
    while (cursor < cappedEnd) {
      const date = new Date(cursor);
      const hour = date.getHours();
      const hourEnd = new Date(date);
      hourEnd.setMinutes(0, 0, 0);
      hourEnd.setHours(hour + 1);
      const segmentEnd = Math.min(cappedEnd, hourEnd.getTime());
      buckets[hour] += segmentEnd - cursor;
      cursor = segmentEnd;
    }
  }
  return buckets;
}

export function computeTimeByGroup(
  activities: Activity[],
  groupById: Map<string, ActivityGroup>,
  allTimerByActivity: Map<string, Record<string, number>>,
  fromDate: Date,
  toDate: Date,
): { groupId: string; groupName: string; color: string; ms: number }[] {
  const totals = new Map<string, number>();

  for (const activity of activities) {
    const timerByDate = allTimerByActivity.get(activity.id);
    if (!timerByDate) continue;
    const ms = sumTimerMsInRange(timerByDate, fromDate, toDate);
    if (ms <= 0) continue;
    totals.set(activity.group_id, (totals.get(activity.group_id) ?? 0) + ms);
  }

  return [...totals.entries()]
    .map(([groupId, ms]) => {
      const group = groupById.get(groupId);
      return {
        groupId,
        groupName: group?.name ?? "Unknown",
        color: group?.color ?? "#3b82f6",
        ms,
      };
    })
    .sort((a, b) => b.ms - a.ms);
}

export function buildAggregateHeatmap90(
  activities: Activity[],
  entriesByDate: Map<string, import("@/lib/db/types").DailyEntry>,
  breakDays: Set<string>,
): HeatmapDay[] {
  const today = getToday();
  const from = shiftDate(today, -89);
  const days: HeatmapDay[] = [];
  let cur = from;

  while (cur <= today) {
    const dateStr = toDateString(cur);
    const { completed, scheduled } = computeCompletionTotals(
      activities,
      entriesByDate,
      breakDays,
      cur,
      cur,
    );
    const rate = completionRate(completed, scheduled);
    days.push({
      dateStr,
      isBeforeCreation: false,
      completionRate: rate ?? undefined,
      habitsCompleted: scheduled > 0 ? completed : undefined,
      habitsScheduled: scheduled > 0 ? scheduled : undefined,
      status: rate === null ? "not_scheduled" : rate === 100 ? "done" : rate === 0 ? "missed" : undefined,
    });
    cur = shiftDate(cur, 1);
  }

  return days;
}

export function buildMonthlyCompletionFromTotals(
  dailyTotals: Map<string, { completed: number; scheduled: number }>,
): MonthlyCompletionPoint[] {
  const today = getToday();
  const months: { year: number; month: number; key: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }

  const buckets = new Map(months.map((m) => [m.key, { completed: 0, scheduled: 0 }]));

  for (const [dateStr, totals] of dailyTotals) {
    const monthKey = dateStr.slice(0, 7);
    const bucket = buckets.get(monthKey);
    if (bucket) {
      bucket.completed += totals.completed;
      bucket.scheduled += totals.scheduled;
    }
  }

  return months.map(({ year, month, key }) => {
    const { completed, scheduled } = buckets.get(key)!;
    const label = new Date(year, month, 1).toLocaleDateString(undefined, { month: "short" });
    return {
      monthKey: key,
      label,
      rate: completionRate(completed, scheduled),
      completed,
      scheduled,
    };
  });
}

export function buildDailyCompletionTotals(
  activities: Activity[],
  entriesByDate: Map<string, import("@/lib/db/types").DailyEntry>,
  breakDays: Set<string>,
  fromDate: Date,
  toDate: Date,
): Map<string, { completed: number; scheduled: number }> {
  const map = new Map<string, { completed: number; scheduled: number }>();
  let cur = fromDate;
  while (cur <= toDate) {
    const dateStr = toDateString(cur);
    map.set(dateStr, computeCompletionTotals(activities, entriesByDate, breakDays, cur, cur));
    cur = shiftDate(cur, 1);
  }
  return map;
}
