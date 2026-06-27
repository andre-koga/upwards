import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { BarChart3, Clock, Layers } from "lucide-react";
import { getActivityDisplayName } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { loadGroupStats, type GroupStats } from "@/lib/stats";
import { StatsPageShell } from "@/components/stats/stats-page-shell";
import { StatsSectionCard } from "@/components/stats/stats-section-card";
import { ActivityNavCard } from "@/components/stats/activity-nav-card";
import { GroupStatsCore } from "@/components/stats/group-stats-core";
import { TimeOfDayChart } from "@/components/stats/time-of-day-chart";
import { timeOfDayHasData } from "@/lib/stats/aggregates";

export default function GroupStatsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    setLoading(true);
    loadGroupStats(groupId)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

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
          "Group"
        )
      }
      icon={<BarChart3 className="h-6 w-6 shrink-0" />}
      subtitle="How this group is performing"
      backTo="/stats"
      backTitle="Back to stats"
      loading={loading}
    >
      {!loading && !stats && (
        <p className="text-sm text-muted-foreground">Group not found.</p>
      )}

      {stats && (
        <div className="flex flex-col gap-2">
          <GroupStatsCore stats={stats} color={color} />

          {stats.habitComparison.length > 0 && (
            <StatsSectionCard icon={Layers} label="Activities · 30d">
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
            <StatsSectionCard icon={Clock} label="Time of day · 30d">
              <TimeOfDayChart segments={stats.timeOfDaySegments} />
            </StatsSectionCard>
          )}

          {stats.habitComparison.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No habits in this group yet.
            </p>
          )}
        </div>
      )}
    </StatsPageShell>
  );
}
