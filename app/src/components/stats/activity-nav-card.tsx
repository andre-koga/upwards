import { ChevronRight, Clock, Sparkles } from "lucide-react";
import { formatCompoundScore } from "@/lib/activity";
import type { ActivitySparklineDay } from "@/lib/stats";
import { formatDuration } from "@/lib/stats/format";
import { cn } from "@/lib/utils";
import { SparklineBar } from "./sparkline-bar";
import { StatPill } from "./stat-pill";

const MISSING_STAT = "—";

function ActivityCompletionSparkline({
  days,
  color,
}: {
  days: ActivitySparklineDay[];
  color: string;
}) {
  if (days.length === 0) return null;

  return (
    <div className="flex h-4 w-full items-end gap-px" aria-hidden>
      {days.map((day, i) => {
        const height =
          day.rate > 0 ? Math.max(2, Math.round((day.rate / 100) * 16)) : 2;
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

function ActivityTimerSparkline({
  days,
  color,
}: {
  days: ActivitySparklineDay[];
  color: string;
}) {
  if (days.length === 0) return null;

  const maxMs = Math.max(...days.map((d) => d.ms), 1);

  return (
    <div className="flex h-4 w-full items-end gap-px" aria-hidden>
      {days.map((day, i) => {
        const height =
          day.ms > 0 ? Math.max(2, Math.round((day.ms / maxMs) * 16)) : 2;
        return (
          <SparklineBar
            key={i}
            height={height}
            color={color}
            isBreakDay={day.isBreakDay}
            hasValue={day.ms > 0}
          />
        );
      })}
    </div>
  );
}

export function ActivityNavCard({
  name,
  color,
  completionRate30d,
  completed30d,
  scheduled30d,
  sparklineDays,
  compoundScore,
  trackedMs30d,
  onClick,
  className,
  completed = false,
}: {
  name: string;
  color: string;
  completionRate30d: number | null;
  completed30d: number;
  scheduled30d: number;
  sparklineDays: ActivitySparklineDay[];
  compoundScore?: number | null;
  trackedMs30d: number;
  onClick?: () => void;
  className?: string;
  completed?: boolean;
}) {
  const showCompletion = scheduled30d > 0;
  const showTimerSparkline = !showCompletion && trackedMs30d > 0;
  const completionLabel = showCompletion
    ? completionRate30d === null
      ? MISSING_STAT
      : `${Math.round(completionRate30d)}%`
    : MISSING_STAT;
  const scoreLabel =
    compoundScore != null ? formatCompoundScore(compoundScore) : MISSING_STAT;
  const timeLabel =
    trackedMs30d > 0 ? formatDuration(trackedMs30d) : MISSING_STAT;

  const body = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className={cn(
              "min-w-0 truncate text-sm font-medium leading-tight",
              completed && "text-muted-foreground line-through",
            )}
          >
            {name}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <StatPill icon={<Sparkles className="h-2.5 w-2.5 shrink-0" aria-hidden />}>
              {scoreLabel}
            </StatPill>
            <StatPill icon={<Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />}>
              {timeLabel}
            </StatPill>
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums leading-tight">
          {completionLabel}
        </span>
        {onClick && (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </div>
      {(showCompletion || showTimerSparkline) && (
        <div className="space-y-1">
          {showCompletion && (
            <>
              <ActivityCompletionSparkline days={sparklineDays} color={color} />
              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>
                  {completed30d}/{scheduled30d}
                </span>
                <span>30d</span>
              </div>
            </>
          )}
          {showTimerSparkline && (
            <>
              <ActivityTimerSparkline days={sparklineDays} color={color} />
              <div className="flex justify-end text-[10px] text-muted-foreground">
                <span>30d</span>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );

  const classNames = cn(
    "flex w-full flex-col gap-1.5 rounded-lg text-left",
    className,
  );

  if (!onClick) {
    return <div className={classNames}>{body}</div>;
  }

  return (
    <button type="button" className={classNames} onClick={onClick}>
      {body}
    </button>
  );
}
