import { useRef } from "react";
import { formatDuration } from "@/lib/stats/format";
import type { TimeOfDaySegment } from "@/lib/stats/types";
import { timeOfDayTotalsFromSegments } from "@/lib/stats/aggregates";
import { FloatingTooltip } from "./floating-tooltip";
import { useFloatingTooltip } from "./use-floating-tooltip";

type TimeOfDayChartProps =
  | {
      buckets: number[];
      color: string;
      segments?: never;
    }
  | {
      segments: TimeOfDaySegment[];
      buckets?: never;
      color?: never;
    };

export function TimeOfDayChart(props: TimeOfDayChartProps) {
  const { tooltip, visible, show } = useFloatingTooltip();
  const containerRef = useRef<HTMLDivElement>(null);

  const segments = props.segments;
  const buckets = segments
    ? timeOfDayTotalsFromSegments(segments)
    : props.buckets;
  const max = Math.max(...buckets, 1);
  const hasData = buckets.some((v) => v > 0);

  if (!hasData) return null;

  const handleClick = (
    e: React.MouseEvent<HTMLDivElement>,
    hourTotal: number
  ) => {
    if (hourTotal <= 0) return;
    const cRect = containerRef.current?.getBoundingClientRect();
    const eRect = e.currentTarget.getBoundingClientRect();
    show(
      eRect.left - (cRect?.left ?? 0) + eRect.width / 2,
      eRect.top - (cRect?.top ?? 0),
      formatDuration(hourTotal)
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-12 items-end gap-px">
        {buckets.map((hourTotal, hour) => (
          <div
            key={hour}
            className="min-w-0 flex-1 cursor-pointer overflow-hidden rounded-t-sm bg-muted"
            style={{
              height:
                hourTotal > 0
                  ? `${Math.max(8, (hourTotal / max) * 100)}%`
                  : "2px",
            }}
            onClick={(e) => hourTotal > 0 && handleClick(e, hourTotal)}
          >
            {hourTotal > 0 && segments && segments.length > 0 ? (
              <div className="flex h-full flex-col-reverse">
                {segments.map((seg) => {
                  const ms = seg.buckets[hour];
                  if (ms <= 0) return null;
                  return (
                    <div
                      key={seg.id}
                      style={{
                        flexGrow: ms,
                        flexShrink: 0,
                        flexBasis: 0,
                        backgroundColor: seg.color,
                        opacity: seg.opacity ?? 1,
                      }}
                    />
                  );
                })}
              </div>
            ) : hourTotal > 0 ? (
              <div
                className="h-full w-full"
                style={{ backgroundColor: props.color }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>12a</span>
        <span>12p</span>
        <span>11p</span>
      </div>
      {segments && segments.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {segments.map((seg) => (
            <div
              key={seg.id}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
            >
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{
                  backgroundColor: seg.color,
                  opacity: seg.opacity ?? 1,
                }}
              />
              <span className="truncate">{seg.label}</span>
            </div>
          ))}
        </div>
      )}
      {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
    </div>
  );
}
