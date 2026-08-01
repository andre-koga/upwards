import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Flame,
  Sparkles,
  CalendarDays,
  TrendingUp,
  BarChart3,
} from "lucide-react";
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
  const { t } = useTranslation("stats");
  const isCompletion = stats.hasRoutine;

  const weekdayStats = useMemo(
    () => computeAllTimeWeekdayStats(stats),
    [stats]
  );
  const monthlyCompletion = useMemo(
    () => (stats.hasRoutine ? computeMonthlyCompletionRates(stats) : null),
    [stats]
  );
  const heatmap90 = useMemo(() => buildHeatmap90(stats), [stats]);

  return (
    <div className="flex flex-col gap-2">
      {stats.hasRoutine && (
        <div className="flex items-center rounded-xl border bg-muted/30 p-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wide">
                {t("labels.score")}
              </span>
            </div>
            <p className="text-xl font-bold tabular-nums leading-none">
              {formatCompoundScore(stats.compoundScore ?? 1)}
            </p>
            <p className="text-[10px] leading-tight text-muted-foreground">
              {t("labels.scoreHelper")}
            </p>
          </div>
          <div className="mx-3 w-px self-stretch bg-border" />
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Flame className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wide">
                {stats.isNever ? t("labels.cleanStreak") : t("labels.streak")}
              </span>
            </div>
            <p className="text-xl font-bold tabular-nums leading-none">
              {stats.currentStreak}
              <span className="font-medium text-muted-foreground"> / </span>
              {stats.bestStreak}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("labels.currentBest")}
            </p>
          </div>
        </div>
      )}

      <StatsSectionCard icon={CalendarDays} label={t("labels.last90Days")}>
        <ConsistencyHeatmap
          days={heatmap90}
          color={color}
          mode="activity"
          isNever={stats.isNever}
          hasRoutine={stats.hasRoutine}
        />
      </StatsSectionCard>

      {monthlyCompletion && (
        <StatsSectionCard icon={TrendingUp} label={t("labels.completionRate")}>
          <MonthlyLineChart points={monthlyCompletion} color={color} />
        </StatsSectionCard>
      )}

      <StatsSectionCard icon={BarChart3} label={t("labels.byDayOfWeek")}>
        <WeekdayBarChart
          weekdayTimerMs={
            isCompletion ? undefined : weekdayStats.weekdayTimerAvgMs
          }
          weekdayCompletion={
            isCompletion ? weekdayStats.weekdayCompletion : undefined
          }
          color={color}
        />
      </StatsSectionCard>
    </div>
  );
}
