import { useParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trophy, Clock, BarChart3, TrendingUp, Sparkles } from "lucide-react";
import { getActivityDisplayName } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { loadActivityExtendedStats } from "@/lib/stats";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatDuration } from "@/lib/stats/format";
import { formatWeekdayShortDate, fromDateString } from "@/lib/time-utils";
import { StatsPageShell } from "@/components/stats/stats-page-shell";
import { StatsSectionCard } from "@/components/stats/stats-section-card";
import { ActivityStatsCore } from "@/components/stats/activity-stats-core";
import { ScoreLineChart } from "@/components/stats/score-line-chart";
import { TimeOfDayChart } from "@/components/stats/time-of-day-chart";
import { db } from "@/lib/db";

const MAX_SESSIONS_SHOWN = 20;

export default function ActivityStatsPage() {
  const { t } = useTranslation("stats");
  const { groupId, activityId } = useParams<{
    groupId: string;
    activityId: string;
  }>();
  const { data, loading, error } = useAsyncData(
    () =>
      groupId && activityId
        ? Promise.all([
            loadActivityExtendedStats(activityId, groupId),
            db.activityGroups.get(groupId),
            db.activities.get(activityId),
          ])
        : Promise.resolve(null),
    [groupId, activityId]
  );

  const stats = data?.[0] ?? null;
  const group = data?.[1] ?? null;
  const activity = data?.[2] ?? null;

  if (!groupId || !activityId) {
    return <Navigate to="/stats" replace />;
  }

  const color = group?.color || DEFAULT_GROUP_COLOR;
  const activityName = activity
    ? getActivityDisplayName(activity, group)
    : t("habit");

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
      subtitle={t("habitSubtitle")}
      backTo={`/stats/groups/${groupId}`}
      backTitle={t("backToGroup")}
      loading={loading}
    >
      {error && <p className="text-sm text-destructive">{t("loadError")}</p>}
      {!loading && !error && !stats && (
        <p className="text-sm text-muted-foreground">{t("habitNotFound")}</p>
      )}

      {stats && (
        <div className="flex flex-col gap-2">
          <ActivityStatsCore stats={stats} color={color} />

          {stats.compoundScoreSeries90d &&
            stats.compoundScoreSeries90d.length > 0 && (
              <StatsSectionCard icon={Sparkles} label={t("sections.score90d")}>
                <ScoreLineChart
                  points={stats.compoundScoreSeries90d}
                  color={color}
                />
              </StatsSectionCard>
            )}

          {stats.activityCompletionRate90d !== null &&
            stats.groupCompletionRate90d !== null && (
              <StatsSectionCard
                icon={TrendingUp}
                label={t("sections.vsGroup90d")}
              >
                <p className="text-center text-sm">
                  <span className="font-semibold tabular-nums">
                    {t("vsGroup.you", {
                      rate: stats.activityCompletionRate90d,
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    ·{" "}
                    {t("vsGroup.groupAvg", {
                      rate: stats.groupCompletionRate90d,
                    })}
                  </span>
                </p>
              </StatsSectionCard>
            )}

          <StatsSectionCard icon={Trophy} label={t("sections.records")}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-semibold tabular-nums">
                  {stats.records.longestStreak}d
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("records.longestStreak")}
                </p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">
                  {stats.records.bestMonthRate !== null
                    ? `${stats.records.bestMonthRate}%`
                    : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("records.bestMonth")}
                  {stats.records.bestMonthLabel
                    ? ` (${stats.records.bestMonthLabel})`
                    : ""}
                </p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">
                  {formatDuration(stats.records.busiestDayMs)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("records.busiestDay")}
                  {stats.records.busiestDayStr
                    ? ` (${stats.records.busiestDayStr})`
                    : ""}
                </p>
              </div>
              <div>
                <p className="font-semibold tabular-nums">
                  {formatDuration(stats.records.totalTrackedMs)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("records.allTimeTracked")}
                </p>
              </div>
            </div>
          </StatsSectionCard>

          {stats.sessions.length > 0 && (
            <StatsSectionCard icon={Clock} label={t("sections.recentSessions")}>
              <ul className="space-y-1.5 text-sm">
                {stats.sessions.slice(0, MAX_SESSIONS_SHOWN).map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-2 text-muted-foreground"
                  >
                    <span>
                      {formatWeekdayShortDate(fromDateString(session.dateStr))}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatDuration(session.durationMs)}
                    </span>
                  </li>
                ))}
              </ul>
            </StatsSectionCard>
          )}

          {stats.timeOfDayBuckets.some((v) => v > 0) && (
            <StatsSectionCard icon={Clock} label={t("sections.timeOfDay30d")}>
              <TimeOfDayChart buckets={stats.timeOfDayBuckets} color={color} />
            </StatsSectionCard>
          )}
        </div>
      )}
    </StatsPageShell>
  );
}
