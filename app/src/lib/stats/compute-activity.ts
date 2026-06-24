import { getEffectiveToday } from "@/lib/session/day-reset";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";
import type { ActivityStats, HeatmapDay, MonthlyCompletionPoint } from "./types";

export function computeAllTimeWeekdayStats(raw: ActivityStats): {
  weekdayTimerAvgMs: number[];
  weekdayCompletion: [number, number][];
} {
  const todayStr = getEffectiveToday();
  const today = startOfDay(new Date(todayStr + "T00:00:00"));
  const createdAt = startOfDay(new Date(raw.createdAtStr + "T00:00:00"));

  const weekdayTimerTotalMs = [0, 0, 0, 0, 0, 0, 0];
  const weekdayOccurrences = [0, 0, 0, 0, 0, 0, 0];
  const weekdayCompletion: [number, number][] = Array.from({ length: 7 }, () => [0, 0]);

  let cur = createdAt;
  while (cur <= today) {
    const d = toDateString(cur);
    const dow = cur.getDay();
    weekdayOccurrences[dow]++;
    weekdayTimerTotalMs[dow] += raw.timerByDate[d] ?? 0;

    const status = raw.completionByDate[d];
    if (status && status !== "not_scheduled" && status !== "break") {
      weekdayCompletion[dow][1]++;
      if (status === "done") weekdayCompletion[dow][0]++;
    }

    cur = shiftDate(cur, 1);
  }

  const weekdayTimerAvgMs = weekdayTimerTotalMs.map((total, i) =>
    weekdayOccurrences[i] > 0 ? Math.round(total / weekdayOccurrences[i]) : 0,
  );

  return { weekdayTimerAvgMs, weekdayCompletion };
}

export function computeMonthlyCompletionRates(raw: ActivityStats): MonthlyCompletionPoint[] {
  const todayStr = getEffectiveToday();
  const today = startOfDay(new Date(todayStr + "T00:00:00"));

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

  let cur = startOfDay(new Date(raw.createdAtStr + "T00:00:00"));
  while (cur <= today) {
    const d = toDateString(cur);
    const monthKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(monthKey);
    if (bucket) {
      const status = raw.completionByDate[d];
      if (status && status !== "not_scheduled" && status !== "break") {
        bucket.scheduled++;
        if (status === "done") bucket.completed++;
      }
    }
    cur = shiftDate(cur, 1);
  }

  return months.map(({ year, month, key }) => {
    const { completed, scheduled } = buckets.get(key)!;
    const label = new Date(year, month, 1).toLocaleDateString(undefined, { month: "short" });
    return {
      monthKey: key,
      label,
      rate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : null,
      completed,
      scheduled,
    };
  });
}

export function buildHeatmapDays(
  stats: ActivityStats,
  fromDate: Date,
  toDate: Date,
): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  let cur = fromDate;
  while (cur <= toDate) {
    const d = toDateString(cur);
    const isBeforeCreation = d < stats.createdAtStr;
    const ms = stats.timerByDate[d];
    const status = isBeforeCreation
      ? undefined
      : stats.hasRoutine
        ? (stats.completionByDate[d] ?? "not_scheduled")
        : undefined;
    const isBreakDay =
      !isBeforeCreation && stats.hasRoutine && !stats.isNever && stats.breakDateStrs.has(d);
    days.push({ dateStr: d, ms, status, isBeforeCreation, isBreakDay });
    cur = shiftDate(cur, 1);
  }
  return days;
}

export function buildHeatmap90(stats: ActivityStats): HeatmapDay[] {
  const todayStr = getEffectiveToday();
  const today = startOfDay(new Date(todayStr + "T00:00:00"));
  const ninetyDaysAgo = shiftDate(today, -89);
  return buildHeatmapDays(stats, ninetyDaysAgo, today);
}

export function buildSparklineWeeks(
  completionByDate: Record<string, import("./types").DayStatus>,
  createdAtStr: string,
  weeks: number,
): HeatmapDay[] {
  const todayStr = getEffectiveToday();
  const today = startOfDay(new Date(todayStr + "T00:00:00"));
  const from = shiftDate(today, -(weeks * 7 - 1));
  const days: HeatmapDay[] = [];
  let cur = from;
  while (cur <= today) {
    const d = toDateString(cur);
    const isBeforeCreation = d < createdAtStr;
    const status = isBeforeCreation ? undefined : (completionByDate[d] ?? "not_scheduled");
    days.push({ dateStr: d, status, isBeforeCreation });
    cur = shiftDate(cur, 1);
  }
  return days;
}
