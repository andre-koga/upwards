import { CalendarDays } from "lucide-react";
import { formatCompoundScore } from "@/lib/activity";
import type { GroupStats } from "@/lib/stats";
import { formatDuration } from "@/lib/stats/format";
import { cn } from "@/lib/utils";
import { StatsSectionCard } from "./stats-section-card";
import { ConsistencyHeatmap } from "./consistency-heatmap";

export function GroupStatsCore({
  stats,
  color,
}: {
  stats: GroupStats;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border bg-muted/30 p-3">
        <div
          className={cn(
            "grid gap-3 text-center",
            stats.groupCompoundScore !== null ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          <div>
            <p className="text-xl font-bold tabular-nums">
              {stats.completionRate30d !== null ? `${stats.completionRate30d}%` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">30d completion</p>
          </div>
          {stats.groupCompoundScore !== null && (
            <div>
              <p className="text-xl font-bold tabular-nums">
                {formatCompoundScore(stats.groupCompoundScore)}
              </p>
              <p className="text-[11px] text-muted-foreground">Avg score</p>
            </div>
          )}
        </div>
        <div className="mt-3 flex justify-center gap-6 border-t border-border pt-3 text-center text-sm">
          <div>
            <p className="font-semibold tabular-nums">{stats.activeHabitCount}</p>
            <p className="text-[11px] text-muted-foreground">Active habits</p>
          </div>
          <div>
            <p className="font-semibold tabular-nums">
              {formatDuration(stats.totalTrackedMs)}
            </p>
            <p className="text-[11px] text-muted-foreground">All-time tracked</p>
          </div>
        </div>
      </div>

      <StatsSectionCard icon={CalendarDays} label="90-day consistency">
        <ConsistencyHeatmap
          days={stats.consistencyHeatmap90}
          mode="aggregate"
          aggregateColor={color}
        />
      </StatsSectionCard>
    </div>
  );
}
