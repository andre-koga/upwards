import type { ActivitySparklineDay } from "@/lib/stats";
import { formatDuration } from "@/lib/stats/format";
import { cn } from "@/lib/utils";

function ActivityDaySparkline({
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
          day.ms > 0
            ? Math.max(2, Math.round((day.ms / maxMs) * 16))
            : day.rate > 0
              ? Math.max(2, Math.round((day.rate / 100) * 16))
              : 2;
        const active = day.ms > 0 || day.rate > 0;
        return (
          <div
            key={i}
            className="min-w-0 flex-1 rounded-[1px] bg-muted"
            style={{
              height,
              backgroundColor: active ? color : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function detailLabel(
  scheduled30d: number,
  completed30d: number,
  sparklineDays: ActivitySparklineDay[],
): string {
  if (scheduled30d > 0) {
    return `${completed30d}/${scheduled30d}`;
  }
  const trackedMs = sparklineDays.reduce((sum, day) => sum + day.ms, 0);
  return trackedMs > 0 ? formatDuration(trackedMs) : "—";
}

export function ActivityNavCard({
  name,
  color,
  completionRate30d,
  completed30d,
  scheduled30d,
  sparklineDays,
  onClick,
  className,
}: {
  name: string;
  color: string;
  completionRate30d: number | null;
  completed30d: number;
  scheduled30d: number;
  sparklineDays: ActivitySparklineDay[];
  onClick?: () => void;
  className?: string;
}) {
  const rateLabel =
    completionRate30d === null ? "—" : `${Math.round(completionRate30d)}%`;

  const body = (
    <>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">{name}</span>
        <p className="shrink-0 text-sm font-semibold tabular-nums leading-tight">{rateLabel}</p>
      </div>
      <div className="space-y-1">
        <ActivityDaySparkline days={sparklineDays} color={color} />
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{detailLabel(scheduled30d, completed30d, sparklineDays)}</span>
          <span>30d</span>
        </div>
      </div>
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
