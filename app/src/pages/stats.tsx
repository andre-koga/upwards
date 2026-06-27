import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  CalendarDays,
  TrendingUp,
  Clock,
  Flame,
  BookOpen,
  Layers,
} from "lucide-react";
import { DEFAULT_GROUP_COLOR, THEME_PRIMARY_COLOR } from "@/lib/color-utils";
import { loadOverallStats, type OverallStats } from "@/lib/stats";
import { formatDuration } from "@/lib/stats/format";
import { StatsPageShell } from "@/components/stats/stats-page-shell";
import { StatsSectionCard } from "@/components/stats/stats-section-card";
import { ConsistencyHeatmap } from "@/components/stats/consistency-heatmap";
import { MonthlyLineChart } from "@/components/stats/monthly-line-chart";
import { GroupNavCard } from "@/components/stats/group-nav-card";
import { TimeOfDayChart } from "@/components/stats/time-of-day-chart";
import { timeOfDayHasData } from "@/lib/stats/aggregates";

export default function StatsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadOverallStats()
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
  }, []);

  const weekRate =
    stats?.weekCompletionRate !== null && stats?.weekCompletionRate !== undefined
      ? `${stats.weekCompletionRate}%`
      : "—";

  return (
    <StatsPageShell
      title="Stats"
      icon={<Sparkles className="h-6 w-6 shrink-0" />}
      subtitle="Your overall habit performance"
      loading={loading}
    >
      {stats && (
        <div className="flex flex-col gap-2">
          <StatsSectionCard icon={TrendingUp} label="This week">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold tabular-nums">{weekRate}</p>
                <p className="text-[11px] text-muted-foreground">Completion</p>
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {stats.weekWins}
                  <span className="text-base font-medium text-muted-foreground">
                    /{stats.weekScheduled}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">Wins</p>
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {formatDuration(stats.weekTrackedMs)}
                </p>
                <p className="text-[11px] text-muted-foreground">Tracked</p>
              </div>
            </div>
          </StatsSectionCard>

          <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/30 p-3 text-center">
            <div className="flex flex-col items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-lg font-bold tabular-nums">{stats.loginStreak}d</p>
              <p className="text-[10px] text-muted-foreground">Check-in</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-lg font-bold tabular-nums">
                {stats.journalStreak ?? "—"}
                {stats.journalStreak !== null ? "d" : ""}
              </p>
              <p className="text-[10px] text-muted-foreground">Journal</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-lg font-bold tabular-nums">{stats.bestCurrentHabitStreak}d</p>
              <p className="text-[10px] text-muted-foreground">Best streak</p>
            </div>
          </div>

          <StatsSectionCard icon={CalendarDays} label="90-day consistency">
            <ConsistencyHeatmap
              days={stats.consistencyHeatmap90}
              mode="aggregate"
            />
          </StatsSectionCard>

          {stats.groups.length > 0 && (
            <StatsSectionCard icon={Layers} label="Groups · 30d">
              <div className="flex flex-col gap-1">
                {stats.groups.map((g) => (
                  <GroupNavCard
                    key={g.group.id}
                    name={g.group.name}
                    color={g.group.color || DEFAULT_GROUP_COLOR}
                    habitCount={g.habitCount}
                    completionRate30d={g.completionRate30d}
                    trackedMs30d={g.trackedMs30d}
                    sparklineDays={g.sparklineDays}
                    onClick={() => navigate(`/stats/groups/${g.group.id}`)}
                  />
                ))}
              </div>
            </StatsSectionCard>
          )}

          {(stats.weeklyCompletionByGroup.length > 0 ||
            stats.weeklyCompletion.some((p) => p.rate !== null)) && (
            <StatsSectionCard icon={TrendingUp} label="Completion rate">
              <MonthlyLineChart
                series={
                  stats.weeklyCompletionByGroup.length > 0
                    ? stats.weeklyCompletionByGroup
                    : undefined
                }
                points={
                  stats.weeklyCompletionByGroup.length === 0
                    ? stats.weeklyCompletion
                    : undefined
                }
                xAxisLabels={stats.monthlyCompletion}
                color={
                  stats.weeklyCompletionByGroup.length === 0
                    ? THEME_PRIMARY_COLOR
                    : undefined
                }
                isNever={false}
              />
            </StatsSectionCard>
          )}

          {timeOfDayHasData(stats.timeOfDaySegments) && (
            <StatsSectionCard icon={Clock} label="Time of day · 30d">
              <TimeOfDayChart segments={stats.timeOfDaySegments} />
            </StatsSectionCard>
          )}

          {stats.groups.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Create a group in Projects to start tracking stats.
            </p>
          )}
        </div>
      )}
    </StatsPageShell>
  );
}
