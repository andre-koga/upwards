import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import { effectiveDateForMs } from "@/lib/activity/period-day-utils";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";
import { getActiveLocaleTag } from "@/lib/i18n";
import {
  computeCompletionTotals,
  completionRate,
  getToday,
} from "./completion";
import type { HeatmapDay, MonthlyCompletionPoint, TimeOfDaySegment } from "./types";

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
const HOUR_COUNT = 24;

function getTimeOfDayWindow(): { fromMs: number; toMs: number } {
  const today = getToday();
  const fromDate = shiftDate(today, -(TIME_OF_DAY_WINDOW_DAYS - 1));
  return {
    fromMs: startOfDay(fromDate).getTime(),
    toMs: startOfDay(shiftDate(today, 1)).getTime(),
  };
}

function emptyHourBuckets(): number[] {
  return Array.from({ length: HOUR_COUNT }, () => 0);
}

function addPeriodMsToHourBuckets(
  buckets: number[],
  startMs: number,
  endMs: number,
  fromMs: number,
  toMs: number,
): void {
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

/** Total tracked ms per clock hour (0–23) over the last 30 days. */
export function buildTimeOfDayBuckets(periods: ActivityPeriod[]): number[] {
  const { fromMs, toMs } = getTimeOfDayWindow();
  const buckets = emptyHourBuckets();
  for (const p of periods) {
    if (p.deleted_at || !p.end_time) continue;
    const startMs = new Date(p.start_time).getTime();
    const endMs = new Date(p.end_time).getTime();
    if (endMs <= startMs) continue;
    addPeriodMsToHourBuckets(buckets, startMs, endMs, fromMs, toMs);
  }
  return buckets;
}

export type TimeOfDayContributor = {
  id: string;
  label: string;
  color: string;
  activityIds: Set<string>;
};

/** Per-contributor tracked ms per clock hour over the last 30 days. */
export function buildTimeOfDaySegments(
  periods: ActivityPeriod[],
  contributors: TimeOfDayContributor[],
): TimeOfDaySegment[] {
  const { fromMs, toMs } = getTimeOfDayWindow();
  const contributorByActivity = new Map<string, TimeOfDayContributor>();
  for (const contributor of contributors) {
    for (const activityId of contributor.activityIds) {
      contributorByActivity.set(activityId, contributor);
    }
  }

  const bucketMap = new Map(contributors.map((c) => [c.id, emptyHourBuckets()]));

  for (const p of periods) {
    if (p.deleted_at || !p.end_time) continue;
    const contributor = contributorByActivity.get(p.activity_id);
    if (!contributor) continue;
    const buckets = bucketMap.get(contributor.id);
    if (!buckets) continue;
    const startMs = new Date(p.start_time).getTime();
    const endMs = new Date(p.end_time).getTime();
    if (endMs <= startMs) continue;
    addPeriodMsToHourBuckets(buckets, startMs, endMs, fromMs, toMs);
  }

  return contributors
    .map((c) => ({
      id: c.id,
      label: c.label,
      color: c.color,
      buckets: bucketMap.get(c.id) ?? emptyHourBuckets(),
    }))
    .filter((seg) => seg.buckets.some((v) => v > 0))
    .sort(
      (a, b) =>
        b.buckets.reduce((s, v) => s + v, 0) - a.buckets.reduce((s, v) => s + v, 0),
    );
}

export function timeOfDayHasData(segments: TimeOfDaySegment[]): boolean {
  return segments.some((s) => s.buckets.some((v) => v > 0));
}

export function timeOfDayTotalsFromSegments(segments: TimeOfDaySegment[]): number[] {
  const totals = emptyHourBuckets();
  for (const seg of segments) {
    for (let h = 0; h < HOUR_COUNT; h++) totals[h] += seg.buckets[h];
  }
  return totals;
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
      { countBreakDayMisses: true },
    );
    const rate = completionRate(completed, scheduled);
    days.push({
      dateStr,
      isBeforeCreation: false,
      isBreakDay: breakDays.has(dateStr),
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
    const label = new Date(year, month, 1).toLocaleDateString(getActiveLocaleTag(), { month: "short" });
    return {
      monthKey: key,
      label,
      rate: completionRate(completed, scheduled),
      completed,
      scheduled,
    };
  });
}

export function buildWeeklyCompletionFromTotals(
  dailyTotals: Map<string, { completed: number; scheduled: number }>,
  fromDate: Date,
  toDate: Date,
): MonthlyCompletionPoint[] {
  const points: MonthlyCompletionPoint[] = [];
  let weekStart = fromDate;

  while (weekStart <= toDate) {
    const weekEnd = shiftDate(weekStart, 6);
    const end = weekEnd > toDate ? toDate : weekEnd;
    let completed = 0;
    let scheduled = 0;
    let cur = weekStart;
    while (cur <= end) {
      const totals = dailyTotals.get(toDateString(cur));
      if (totals) {
        completed += totals.completed;
        scheduled += totals.scheduled;
      }
      cur = shiftDate(cur, 1);
    }
    const weekKey = toDateString(weekStart);
    points.push({
      monthKey: weekKey,
      label: "",
      rate: completionRate(completed, scheduled),
      completed,
      scheduled,
    });
    weekStart = shiftDate(weekStart, 7);
  }

  return points;
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
