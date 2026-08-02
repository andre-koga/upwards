import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, Clock, Layers } from "lucide-react";
import { getActivityDisplayName } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { loadGroupStats } from "@/lib/stats";
import { useAsyncData } from "@/hooks/use-async-data";
import { StatsPageShell } from "@/components/stats/stats-page-shell";
import { StatsSectionCard } from "@/components/stats/stats-section-card";
import { ActivityNavCard } from "@/components/stats/activity-nav-card";
import { GroupStatsCore } from "@/components/stats/group-stats-core";
import { TimeOfDayChart } from "@/components/stats/time-of-day-chart";
import { timeOfDayHasData } from "@/lib/stats/aggregates";

export default function GroupStatsPage() {
  const { t } = useTranslation("stats");
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const {
    data: stats,
    loading,
    error,
  } = useAsyncData(
    () => (groupId ? loadGroupStats(groupId) : Promise.resolve(null)),
    [groupId]
  );

  if (!groupId) return <Navigate to="/stats" replace />;

  const color = stats?.group.color || DEFAULT_GROUP_COLOR;

  const goToActivity = (activityId: string) => {
    navigate(`/stats/groups/${groupId}/activities/${activityId}`);
  };

  return (
    <StatsPageShell
      title={
        stats ? (
          <span className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            {stats.group.name}
          </span>
        ) : (
          t("group")
        )
      }
      icon={<BarChart3 className="h-6 w-6 shrink-0" />}
      subtitle={t("groupSubtitle")}
      backTo="/stats"
      backTitle={t("backToStats")}
      loading={loading}
      className="md:max-w-5xl"
      breadcrumbs={[
        { label: t("title"), to: "/stats" },
        { label: stats?.group.name ?? t("group") },
      ]}
    >
      {error && <p className="text-sm text-destructive">{t("loadError")}</p>}
      {!loading && !error && !stats && (
        <p className="text-sm text-muted-foreground">{t("groupNotFound")}</p>
      )}

      {stats && (
        <div className="flex flex-col gap-2">
          <GroupStatsCore stats={stats} color={color} />

          {stats.habitComparison.length > 0 && (
            <StatsSectionCard icon={Layers} label={t("sections.activities30d")}>
              <div className="flex flex-col gap-1">
                {stats.habitComparison.map((row) => (
                  <ActivityNavCard
                    key={row.activity.id}
                    name={getActivityDisplayName(row.activity, stats.group)}
                    color={color}
                    completionRate30d={row.completionRate30d}
                    completed30d={row.completed30d}
                    scheduled30d={row.scheduled30d}
                    sparklineDays={row.sparklineDays}
                    compoundScore={row.compoundScore}
                    trackedMs30d={row.trackedMs30d}
                    completed={!!row.activity.completed_at}
                    onClick={() => goToActivity(row.activity.id)}
                  />
                ))}
              </div>
            </StatsSectionCard>
          )}

          {timeOfDayHasData(stats.timeOfDaySegments) && (
            <StatsSectionCard icon={Clock} label={t("sections.timeOfDay30d")}>
              <TimeOfDayChart segments={stats.timeOfDaySegments} />
            </StatsSectionCard>
          )}

          {stats.habitComparison.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noHabitsInGroup")}
            </p>
          )}
        </div>
      )}
    </StatsPageShell>
  );
}
