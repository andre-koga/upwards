import { ChevronRight, Clock } from "lucide-react";
import type { SparklineDay } from "@/lib/stats";
import { formatDuration } from "@/lib/stats/format";
import { cn } from "@/lib/utils";
import { SparklineBar } from "./sparkline-bar";
import { StatPill } from "./stat-pill";

const MISSING_STAT = "—";

function MiniRateSparkline({ days, color }: { days: SparklineDay[]; color: string }) {
  if (days.length === 0) return null;

  return (
    <div className="flex h-4 w-full items-end gap-px" aria-hidden>
      {days.map((day, i) => {
        const height = day.rate <= 0 ? 2 : Math.max(2, Math.round((day.rate / 100) * 16));
        return (
          <SparklineBar
            key={i}
            height={height}
            color={color}
            isBreakDay={day.isBreakDay}
            hasValue={day.rate > 0}
          />
        );
      })}
    </div>
  );
}

export function GroupNavCard({
  name,
  color,
  habitCount,
  completionRate30d,
  trackedMs30d,
  sparklineDays,
  onClick,
  className,
}: {
  name: string;
  color: string;
  habitCount: number;
  completionRate30d: number | null;
  trackedMs30d: number;
  sparklineDays: SparklineDay[];
  onClick?: () => void;
  className?: string;
}) {
  const rateLabel =
    completionRate30d === null ? "—" : `${Math.round(completionRate30d)}%`;
  const timeLabel =
    trackedMs30d > 0 ? formatDuration(trackedMs30d) : MISSING_STAT;
  const habitLabel = habitCount === 1 ? "1 habit" : `${habitCount} habits`;

  const body = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium leading-tight">{name}</span>
          <StatPill icon={<Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />}>
            {timeLabel}
          </StatPill>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums leading-tight">
          {rateLabel}
        </span>
        {onClick && (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="space-y-1">
        <MiniRateSparkline days={sparklineDays} color={color} />
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{habitLabel}</span>
          <span>30d</span>
        </div>
      </div>
    </>
  );

  if (!onClick) {
    return <div className={cn("flex w-full flex-col gap-1.5 rounded-lg text-left", className)}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-lg text-left transition-colors",
        className,
      )}
      onClick={onClick}
    >
      {body}
    </button>
  );
}
