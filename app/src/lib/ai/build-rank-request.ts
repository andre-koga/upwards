import { db } from "@/lib/db";
import type { Activity, ActivityPeriod, DailyEntry } from "@/lib/db/types";
import { activityTypeOfRoutine } from "@/lib/activity/activity-type";
import { orderActivitiesForToday } from "@/lib/activity/today-order";
import { isRoutineDueOnDate } from "@/lib/activity/utils";
import { fromDateString, shiftDate, toDateString } from "@/lib/time-utils";
import {
  MAX_RANK_ITEMS,
  WINDOW_DAYS,
  type RankItem,
  type RankRequest,
} from "../../../../supabase/functions/_shared/rank-today";

type Candidate = Pick<
  Activity,
  | "id"
  | "routine"
  | "completion_target"
  | "is_pinned"
  | "order_index"
  | "created_at"
>;

/**
 * The rows the AI may order: open, not pinned, and something to do. Pinned rows
 * are the person's own order, done rows are finished, and an avoid habit has no
 * action to schedule. Capped, in the stored order, to keep the call small.
 */
export function pickRankCandidates<T extends Candidate>(
  activities: readonly T[],
  counts: Readonly<Record<string, number>>
): T[] {
  return orderActivitiesForToday(activities, counts)
    .filter((activity) => {
      if (activity.is_pinned) return false;
      if (activity.routine === "never") return false;
      return (counts[activity.id] ?? 0) < (activity.completion_target ?? 1);
    })
    .slice(0, MAX_RANK_ITEMS);
}

export interface RankFactsInput {
  candidates: readonly (Candidate & { name: string })[];
  /** The calendar day being ordered, YYYY-MM-DD. */
  today: string;
  todayCounts: Readonly<Record<string, number>>;
  streaks: Readonly<Record<string, number>>;
  entries: readonly DailyEntry[];
  periods: readonly Pick<
    ActivityPeriod,
    "activity_id" | "start_time" | "end_time"
  >[];
}

/** The numbers about each candidate for the last seven full days. */
export function buildRankFacts(input: RankFactsInput): RankRequest {
  const todayDate = fromDateString(input.today);
  const days = Array.from({ length: WINDOW_DAYS }, (_, index) =>
    shiftDate(todayDate, -(index + 1))
  );
  const entryByDate = new Map(input.entries.map((e) => [e.date, e]));

  const items: RankItem[] = input.candidates.map((activity, index) => {
    const type = activityTypeOfRoutine(activity.routine);
    const target = Math.max(1, activity.completion_target ?? 1);
    const createdOn = toDateString(new Date(activity.created_at));

    const periods = input.periods.filter(
      (period) => period.activity_id === activity.id
    );
    const timedDates = new Set<string>();
    let minutes = 0;
    for (const period of periods) {
      const start = new Date(period.start_time);
      const end = period.end_time ? new Date(period.end_time) : null;
      const startedOn = toDateString(start);
      if (!days.some((day) => toDateString(day) === startedOn)) continue;
      timedDates.add(startedOn);
      if (end)
        minutes += Math.max(0, (end.getTime() - start.getTime()) / 60000);
    }

    let daysDone = 0;
    let daysActive = 0;
    for (const day of days) {
      const date = toDateString(day);
      if (date < createdOn) continue;
      const entry = entryByDate.get(date);
      if (entry?.is_break_day) continue;
      if (type === "time-only") {
        daysActive += 1;
        if (timedDates.has(date)) daysDone += 1;
        continue;
      }
      if (!isRoutineDueOnDate(activity, day)) continue;
      daysActive += 1;
      if ((entry?.task_counts?.[activity.id] ?? 0) >= target) daysDone += 1;
    }

    return {
      key: String(index + 1),
      name: activity.name,
      type: type === "time-only" ? "time-only" : "habit",
      target,
      doneToday: input.todayCounts[activity.id] ?? 0,
      daysDone,
      daysActive,
      streak: type === "time-only" ? 0 : (input.streaks[activity.id] ?? 0),
      minutes: Math.round(minutes),
    };
  });
  return { items };
}

/** Loads the week's entries and sessions, then builds the request. */
export async function loadRankRequest(input: {
  candidates: readonly (Candidate & { name: string })[];
  today: string;
  todayCounts: Readonly<Record<string, number>>;
  streaks: Readonly<Record<string, number>>;
}): Promise<RankRequest> {
  const todayDate = fromDateString(input.today);
  const from = shiftDate(todayDate, -WINDOW_DAYS);
  const fromDate = toDateString(from);
  const toDate = toDateString(shiftDate(todayDate, -1));
  const ids = new Set(input.candidates.map((c) => c.id));

  const [entries, periods] = await Promise.all([
    db.dailyEntries
      .where("date")
      .between(fromDate, toDate, true, true)
      .filter((entry) => !entry.deleted_at)
      .toArray(),
    db.activityPeriods
      .where("start_time")
      .aboveOrEqual(from.toISOString())
      .filter((period) => !period.deleted_at && ids.has(period.activity_id))
      .toArray(),
  ]);
  return buildRankFacts({ ...input, entries, periods });
}
