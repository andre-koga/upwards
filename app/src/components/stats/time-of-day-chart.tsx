import { useRef } from "react";
import { formatDuration } from "@/lib/stats/format";
import { FloatingTooltip, useFloatingTooltip } from "./use-floating-tooltip";

export function TimeOfDayChart({
  buckets,
  color,
}: {
  buckets: number[];
  color: string;
}) {
  const { tooltip, visible, show } = useFloatingTooltip();
  const containerRef = useRef<HTMLDivElement>(null);
  const max = Math.max(...buckets, 1);
  const hasData = buckets.some((v) => v > 0);

  if (!hasData) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>, ms: number) => {
    const cRect = containerRef.current?.getBoundingClientRect();
    const eRect = e.currentTarget.getBoundingClientRect();
    show(
      eRect.left - (cRect?.left ?? 0) + eRect.width / 2,
      eRect.top - (cRect?.top ?? 0),
      formatDuration(ms),
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-12 items-end gap-px">
        {buckets.map((ms, hour) => (
          <div
            key={hour}
            className="min-w-0 flex-1 cursor-pointer rounded-t-sm bg-muted"
            style={{
              height: ms > 0 ? `${Math.max(8, (ms / max) * 100)}%` : "2px",
              backgroundColor: ms > 0 ? color : undefined,
            }}
            onClick={(e) => ms > 0 && handleClick(e, ms)}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>12a</span>
        <span>12p</span>
        <span>11p</span>
      </div>
      {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
    </div>
  );
}
