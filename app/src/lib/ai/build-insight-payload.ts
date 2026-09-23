import { db } from "@/lib/db";
import { toDateString, startOfDay } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { computeActivityStreaksForDate } from "@/lib/streak-utils";

const RANGE_DAYS = 7;

export interface ActivityInsightStat {
  name: string;
  targetPerDay: number;
  completedDays: number;
  totalDays: number;
  streak: number;
}

export interface InsightPayload {
  range: string;
  activities: ActivityInsightStat[];
  journal: {
    entriesThisWeek: number;
    streak: number;
    bookmarkedCount: number;
  };
  completionRate: number;
}

/**
 * Builds the *aggregated* stats sent to the AI provider — never raw journal
 * or task text. This is the main token-budget control point: keep this
 * payload small and numeric.
 */
export async function buildInsightPayload(): Promise<InsightPayload> {
  const today = new Date(`${getEffectiveToday()}T12:00:00`);
  const start = new Date(today);
  start.setDate(start.getDate() - (RANGE_DAYS - 1));
  const startStr = toDateString(startOfDay(start));
  const endStr = toDateString(startOfDay(today));

  const [activities, dailyEntries, journalEntries] = await Promise.all([
    db.activities.filter((a) => !a.is_archived && Boolean(a.name)).toArray(),
    db.dailyEntries
      .where("date")
      .between(startStr, endStr, true, true)
      .filter((e) => !e.deleted_at)
      .toArray(),
    db.journalEntries
      .where("entry_date")
      .between(startStr, endStr, true, true)
      .filter((e) => !e.deleted_at)
      .toArray(),
  ]);

  const streaks = await computeActivityStreaksForDate(activities, today);

  const activityStats: ActivityInsightStat[] = activities.map((activity) => {
    const target = activity.completion_target ?? 1;
    const originStr = toDateString(startOfDay(new Date(activity.created_at)));
    let completedDays = 0;
    let totalDays = 0;
    for (const entry of dailyEntries) {
      if (entry.date < originStr) continue;
      totalDays += 1;
      const count = entry.task_counts?.[activity.id] ?? 0;
      if (count >= target) completedDays += 1;
    }
    return {
      name: activity.name ?? "Untitled",
      targetPerDay: target,
      completedDays,
      totalDays,
      streak: streaks[activity.id] ?? 0,
    };
  });

  const totalPossible = activityStats.reduce((sum, a) => sum + a.totalDays, 0);
  const totalCompleted = activityStats.reduce(
    (sum, a) => sum + a.completedDays,
    0
  );
  const completionRate =
    totalPossible > 0
      ? Math.round((totalCompleted / totalPossible) * 100) / 100
      : 0;

  const latestJournal = journalEntries
    .slice()
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))[0];

  return {
    range: `${RANGE_DAYS}d`,
    activities: activityStats,
    journal: {
      entriesThisWeek: journalEntries.filter((e) =>
        Boolean(e.text_content?.trim())
      ).length,
      streak: latestJournal?.journal_completion_streak ?? 0,
      bookmarkedCount: journalEntries.filter((e) => e.is_bookmarked).length,
    },
    completionRate,
  };
}

/** Stable string used to detect whether the underlying stats actually changed. */
export function fingerprintPayload(payload: InsightPayload): string {
  return JSON.stringify(payload);
}
