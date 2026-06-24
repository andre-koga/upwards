import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import {
  Trophy,
  Clock,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { getActivityDisplayName } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { loadActivityExtendedStats, type ActivityExtendedStats } from "@/lib/stats";
import { formatDuration } from "@/lib/stats/format";
import { formatWeekdayShortDate, fromDateString } from "@/lib/time-utils";
import { StatsPageShell } from "@/components/stats/stats-page-shell";
import { StatsSectionCard } from "@/components/stats/stats-section-card";
import { ActivityStatsCore } from "@/components/stats/activity-stats-core";
import { TimeOfDayChart } from "@/components/stats/time-of-day-chart";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";

const MAX_SESSIONS_SHOWN = 20;

export default function ActivityStatsPage() {
  const { groupId, activityId } = useParams<{ groupId: string; activityId: string }>();
  const [stats, setStats] = useState<ActivityExtendedStats | null>(null);
  const [group, setGroup] = useState<ActivityGroup | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId || !activityId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadActivityExtendedStats(activityId, groupId),
      db.activityGroups.get(groupId),
      db.activities.get(activityId),
    ])
      .then(([extended, loadedGroup, loadedActivity]) => {
        if (!cancelled) {
          setStats(extended);
          setGroup(loadedGroup ?? null);
          setActivity(loadedActivity ?? null);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, activityId]);

  if (!groupId || !activityId) {
    return <Navigate to="/stats" replace />;
  }

  const color = group?.color || DEFAULT_GROUP_COLOR;
  const activityName = activity ? getActivityDisplayName(activity, group) : "Habit";

  return (
    <StatsPageShell
      title={
        <span className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          {activityName}
        </span>
      }
      icon={<BarChart3 className="h-6 w-6 shrink-0" />}
      subtitle="Full habit stats"
      backTo={`/stats/groups/${groupId}`}
      backTitle="Back to group"
      loading={loading}
    >
      {!loading && !stats && (
        <p className="text-sm text-muted-foreground">Habit not found.</p>
      )}

      {stats && (
        <div className="flex flex-col gap-2">
          <ActivityStatsCore stats={stats} color={color} />

          {stats.activityCompletionRate90d !== null && stats.groupCompletionRate90d !== null && (
            <StatsSectionCard icon={TrendingUp} label="Vs group · 90d">
              <p className="text-center text-sm">
                <span className="font-semibold tabular-nums">
                  You: {stats.activityCompletionRate90d}%
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · Group avg: {stats.groupCompletionRate90d}%
                </span>
              </p>
            </StatsSectionCard>
          )}

          <StatsSectionCard icon={Trophy} label="Records">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-semibold tabular-nums">{stats.records.longestStreak}d</p>
                <p className="text-[11px] text-muted-foreground">Longest streak</p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">
                  {stats.records.bestMonthRate !== null
                    ? `${stats.records.bestMonthRate}%`
                    : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Best month
                  {stats.records.bestMonthLabel ? ` (${stats.records.bestMonthLabel})` : ""}
                </p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">
                  {formatDuration(stats.records.busiestDayMs)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Busiest day
                  {stats.records.busiestDayStr ? ` (${stats.records.busiestDayStr})` : ""}
                </p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">
                  {formatDuration(stats.records.totalTrackedMs)}
                </p>
                <p className="text-[11px] text-muted-foreground">All-time tracked</p>
              </div>
            </div>
          </StatsSectionCard>

          {stats.sessions.length > 0 && (
            <StatsSectionCard icon={Clock} label="Recent sessions">
              <ul className="space-y-1.5 text-sm">
                {stats.sessions.slice(0, MAX_SESSIONS_SHOWN).map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-2 text-muted-foreground"
                  >
                    <span>{formatWeekdayShortDate(fromDateString(session.dateStr))}</span>
                    <span className="tabular-nums text-foreground">
                      {formatDuration(session.durationMs)}
                    </span>
                  </li>
                ))}
              </ul>
            </StatsSectionCard>
          )}

          {stats.timeOfDayBuckets.some((v) => v > 0) && (
            <StatsSectionCard icon={Clock} label="Time of day · 30d">
              <TimeOfDayChart buckets={stats.timeOfDayBuckets} color={color} />
            </StatsSectionCard>
          )}
        </div>
      )}
    </StatsPageShell>
  );
}
