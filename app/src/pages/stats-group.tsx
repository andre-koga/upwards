import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import {
  BarChart3,
  TrendingUp,
  Clock,
  ChevronDown,
  Layers,
} from "lucide-react";
import { isNeverRoutine } from "@/lib/activity/never-task";
import { getActivityDisplayName } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { loadGroupStats, type GroupStats } from "@/lib/stats";
import { StatsPageShell } from "@/components/stats/stats-page-shell";
import { StatsSectionCard } from "@/components/stats/stats-section-card";
import { MonthlyLineChart } from "@/components/stats/monthly-line-chart";
import { HorizontalBarChart } from "@/components/stats/horizontal-bar-chart";
import { ActivityNavCard } from "@/components/stats/activity-nav-card";
import { GroupStatsCore } from "@/components/stats/group-stats-core";
import { HabitSparklineRow } from "@/components/stats/habit-sparkline-row";
import { TimeOfDayChart } from "@/components/stats/time-of-day-chart";
import { cn } from "@/lib/utils";

export default function GroupStatsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

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
            <StatsSectionCard icon={Layers} label="Activity completion · 30d">
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
                    onClick={() => goToActivity(row.activity.id)}
                  />
                ))}
              </div>
            </StatsSectionCard>
          )}

          {stats.monthlyCompletion.some((p) => p.rate !== null) && (
            <StatsSectionCard icon={TrendingUp} label="Completion rate">
              <MonthlyLineChart
                points={stats.monthlyCompletion}
                color={color}
                isNever={false}
              />
            </StatsSectionCard>
          )}

          {stats.timerByHabit30d.length > 0 && (
            <StatsSectionCard icon={Clock} label="Timer breakdown · 30d">
              <HorizontalBarChart
                color={color}
                items={stats.timerByHabit30d.map((row) => ({
                  id: row.activityId,
                  label: row.name,
                  value: row.ms,
                }))}
                onItemClick={goToActivity}
              />
            </StatsSectionCard>
          )}

          {stats.timeOfDayBuckets.some((v) => v > 0) && (
            <StatsSectionCard icon={Clock} label="Time of day · 30d">
              <TimeOfDayChart buckets={stats.timeOfDayBuckets} color={color} />
            </StatsSectionCard>
          )}

          {stats.completedHabits.length > 0 && (
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 py-2 text-sm text-muted-foreground"
                onClick={() => setShowCompleted((v) => !v)}
              >
                <span>Completed habits ({stats.completedHabits.length})</span>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", showCompleted && "rotate-180")}
                />
              </button>
              {showCompleted && (
                <div className="space-y-2 opacity-70">
                  {stats.completedHabits.map((row) => (
                    <button
                      key={row.activity.id}
                      type="button"
                      className="flex w-full flex-col gap-1 rounded-lg p-2 text-left hover:bg-muted/40"
                      onClick={() => goToActivity(row.activity.id)}
                    >
                      <span className="truncate text-sm line-through">
                        {getActivityDisplayName(row.activity, stats.group)}
                      </span>
                      <HabitSparklineRow
                        days={row.sparklineWeeks}
                        color={color}
                        isNever={isNeverRoutine(row.activity)}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {stats.habitComparison.length === 0 && stats.completedHabits.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No habits in this group yet.
            </p>
          )}
        </div>
      )}
    </StatsPageShell>
  );
}
