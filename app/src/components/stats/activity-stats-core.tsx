import { useMemo } from "react";
import { Flame, Sparkles, CalendarDays, TrendingUp, BarChart3 } from "lucide-react";
import { formatCompoundScore } from "@/lib/activity";
import type { ActivityStats } from "@/lib/stats";
import {
  buildHeatmap90,
  computeAllTimeWeekdayStats,
  computeMonthlyCompletionRates,
} from "@/lib/stats";
import { StatsSectionCard } from "./stats-section-card";
import { ConsistencyHeatmap } from "./consistency-heatmap";
import { MonthlyLineChart } from "./monthly-line-chart";
import { WeekdayBarChart } from "./weekday-bar-chart";

export function ActivityStatsCore({
  stats,
  color,
}: {
  stats: ActivityStats;
  color: string;
}) {
  const isCompletion = stats.hasRoutine;

  const weekdayStats = useMemo(() => computeAllTimeWeekdayStats(stats), [stats]);
  const monthlyCompletion = useMemo(
    () => (stats.hasRoutine ? computeMonthlyCompletionRates(stats) : null),
    [stats],
  );
  const heatmap90 = useMemo(() => buildHeatmap90(stats), [stats]);

  return (
    <div className="flex flex-col gap-2">
      {stats.hasRoutine && (
        <div className="flex items-center rounded-xl border bg-muted/30 p-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Score</span>
            </div>
            <p className="text-xl font-bold leading-none tabular-nums">
              {formatCompoundScore(stats.compoundScore ?? 1)}
            </p>
            <p className="text-[10px] leading-tight text-muted-foreground">+1% win, −1% miss</p>
          </div>
          <div className="mx-3 w-px self-stretch bg-border" />
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Flame className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wide">
                {stats.isNever ? "Clean streak" : "Streak"}
              </span>
            </div>
            <p className="text-xl font-bold leading-none tabular-nums">
              {stats.currentStreak}
              <span className="font-medium text-muted-foreground"> / </span>
              {stats.bestStreak}
            </p>
            <p className="text-[11px] text-muted-foreground">Current / best</p>
          </div>
        </div>
      )}

      <StatsSectionCard icon={CalendarDays} label="Last 90 days">
        <ConsistencyHeatmap
          days={heatmap90}
          color={color}
          mode="activity"
          isNever={stats.isNever}
          hasRoutine={stats.hasRoutine}
        />
      </StatsSectionCard>

      {monthlyCompletion && (
        <StatsSectionCard icon={TrendingUp} label="Completion rate">
          <MonthlyLineChart points={monthlyCompletion} color={color} isNever={stats.isNever} />
        </StatsSectionCard>
      )}

      <StatsSectionCard icon={BarChart3} label="By day of week">
        <WeekdayBarChart
          weekdayTimerMs={isCompletion ? undefined : weekdayStats.weekdayTimerAvgMs}
          weekdayCompletion={isCompletion ? weekdayStats.weekdayCompletion : undefined}
          color={color}
          isNever={stats.isNever}
        />
      </StatsSectionCard>
    </div>
  );
}
