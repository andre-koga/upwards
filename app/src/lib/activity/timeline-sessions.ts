import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import { getActivityDisplayName } from "@/lib/activity/utils";
import {
  dayBoundsMs,
  sessionShareOfDay,
  sessionsOnDay,
} from "@/lib/activity/period-day-utils";

export interface TimelineSession {
  id: string;
  activityId: string;
  groupId: string;
  name: string;
  groupColor: string;
  intervalMs: number;
  startTime: number;
  note: string | null;
  untimed: boolean;
  completedAtIso: string | null;
  /** The session began before this day; only its share is counted here. */
  fromPreviousDay?: boolean;
  /** The session runs past this day's end; only its share is counted here. */
  continuesNextDay?: boolean;
}

const DERIVED_UNTIMED_PREFIX = "derived-untimed:";

export function derivedUntimedSessionId(
  dateString: string,
  activityId: string
): string {
  return `${DERIVED_UNTIMED_PREFIX}${dateString}:${activityId}`;
}

export function parseDerivedUntimedSessionId(
  sessionId: string
): { date: string; activityId: string } | null {
  if (!sessionId.startsWith(DERIVED_UNTIMED_PREFIX)) return null;
  const rest = sessionId.slice(DERIVED_UNTIMED_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep < 1 || sep === rest.length - 1) return null;
  return {
    date: rest.slice(0, sep),
    activityId: rest.slice(sep + 1),
  };
}

function derivedPillTimeMs(dateString: string, nowMs: number): number {
  const { startMs, endMs } = dayBoundsMs(dateString);
  if (nowMs >= startMs && nowMs < endMs) return nowMs;
  return startMs;
}

function hasTimedOrRunningPeriodOnDay(
  periods: ActivityPeriod[],
  activityId: string,
  dateString: string,
  nowMs: number
): boolean {
  const forActivity = periods.filter(
    (period) => period.activity_id === activityId
  );
  return sessionsOnDay(forActivity, dateString, nowMs).length > 0;
}

function sessionFromActivity(
  activity: Activity,
  group: ActivityGroup | undefined
): Pick<TimelineSession, "activityId" | "groupId" | "name" | "groupColor"> {
  return {
    activityId: activity.id,
    groupId: activity.group_id || "",
    name: getActivityDisplayName(activity, group),
    groupColor: group?.color ?? DEFAULT_GROUP_COLOR,
  };
}

/**
 * Timed sessions come from period facts. Untimed pills are a view of
 * `count >= target` and are never stored as activity_periods rows.
 */
export function buildTimelineSessions(params: {
  periods: ActivityPeriod[];
  dateString: string;
  nowMs: number;
  lookupActivityById: Map<string, Activity>;
  lookupGroupById: Map<string, ActivityGroup>;
  taskCounts?: Record<string, number>;
  completionNotes?: Record<string, string> | null;
  completionTimes?: Record<string, string> | null;
}): TimelineSession[] {
  const {
    periods,
    dateString,
    nowMs,
    lookupActivityById,
    lookupGroupById,
    taskCounts = {},
    completionNotes = {},
    completionTimes = {},
  } = params;
  const { startMs: dayStartMs, endMs: dayEndMs } = dayBoundsMs(dateString);

  const timedSessions = periods
    .filter((period) => !!period.end_time && !period.deleted_at)
    .map((period) => {
      const activity = lookupActivityById.get(period.activity_id);
      const group = activity
        ? lookupGroupById.get(activity.group_id)
        : undefined;
      const startMs = new Date(period.start_time).getTime();
      const endMs = new Date(period.end_time!).getTime();
      const clippedInterval = sessionShareOfDay(
        startMs,
        endMs,
        dateString,
        nowMs
      );
      return {
        id: period.id,
        activityId: period.activity_id,
        groupId: activity?.group_id || "",
        name: activity
          ? getActivityDisplayName(activity, group)
          : "Unknown activity",
        groupColor: activity
          ? (group?.color ?? DEFAULT_GROUP_COLOR)
          : DEFAULT_GROUP_COLOR,
        intervalMs: Math.max(0, clippedInterval),
        startTime: Math.max(startMs, dayStartMs),
        note: period.note,
        untimed: false,
        completedAtIso: null,
        fromPreviousDay: startMs < dayStartMs,
        continuesNextDay: endMs > dayEndMs,
      };
    })
    .filter((session) => session.intervalMs > 0);

  const derived: TimelineSession[] = [];
  for (const activity of lookupActivityById.values()) {
    if (activity.deleted_at) continue;
    const target =
      typeof activity.completion_target === "number"
        ? activity.completion_target
        : 1;
    const count = taskCounts[activity.id] ?? 0;
    if (count < target) continue;
    if (hasTimedOrRunningPeriodOnDay(periods, activity.id, dateString, nowMs)) {
      continue;
    }
    const group = lookupGroupById.get(activity.group_id);
    const note = completionNotes?.[activity.id] ?? null;
    const completionTime = completionTimes?.[activity.id] ?? null;
    const completedAtIso =
      completionTime && !Number.isNaN(new Date(completionTime).getTime())
        ? completionTime
        : null;
    derived.push({
      id: derivedUntimedSessionId(dateString, activity.id),
      ...sessionFromActivity(activity, group),
      intervalMs: 0,
      startTime: completedAtIso
        ? new Date(completedAtIso).getTime()
        : derivedPillTimeMs(dateString, nowMs),
      note,
      untimed: true,
      completedAtIso,
    });
  }

  return [...timedSessions, ...derived].sort(
    (a, b) => b.startTime - a.startTime
  );
}

export function timelineDurationTotalMs(sessions: TimelineSession[]): number {
  return sessions.reduce((total, session) => total + session.intervalMs, 0);
}
