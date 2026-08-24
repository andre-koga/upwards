import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import { getActivityDisplayName } from "@/lib/activity/utils";
import {
  clipPeriodToDay,
  effectiveDayStartMs,
} from "@/lib/activity/period-day-utils";
import { isUntimedPeriod } from "@/lib/activity/untimed-period";

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
}

export function buildTimelineSessions(params: {
  periods: ActivityPeriod[];
  dateString: string;
  nowMs: number;
  lookupActivityById: Map<string, Activity>;
  lookupGroupById: Map<string, ActivityGroup>;
}): TimelineSession[] {
  const { periods, dateString, nowMs, lookupActivityById, lookupGroupById } =
    params;
  const dayStartMs = effectiveDayStartMs(dateString);

  const sessions = periods
    .filter((period) => !!period.end_time && !period.deleted_at)
    .map((period) => {
      const activity = lookupActivityById.get(period.activity_id);
      const group = activity
        ? lookupGroupById.get(activity.group_id)
        : undefined;
      const startMs = new Date(period.start_time).getTime();
      const endMs = new Date(period.end_time!).getTime();
      const untimed = isUntimedPeriod(period.start_time, period.end_time);
      const clippedInterval = untimed
        ? 0
        : clipPeriodToDay(startMs, endMs, dateString, nowMs);
      const clippedStartMs = untimed ? startMs : Math.max(startMs, dayStartMs);
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
        startTime: clippedStartMs,
        note: period.note,
        untimed,
        completedAtIso: untimed ? period.start_time : null,
      };
    })
    .filter((session) => session.untimed || session.intervalMs > 0);

  return sessions.sort((a, b) => b.startTime - a.startTime);
}

export function timelineDurationTotalMs(sessions: TimelineSession[]): number {
  return sessions.reduce((total, session) => total + session.intervalMs, 0);
}
