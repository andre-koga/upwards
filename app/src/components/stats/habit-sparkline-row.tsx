import { useRef } from "react";
import type { HeatmapDay } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { FloatingTooltip, useFloatingTooltip } from "./use-floating-tooltip";

function sparklineTooltip(day: HeatmapDay, isNever?: boolean): string {
  if (day.isBeforeCreation || day.status === "not_scheduled") return "Off";
  if (day.status === "done") return isNever ? "Clean" : "Done";
  if (day.status === "slip") return "Slip";
  if (day.status === "missed") return "Missed";
  if (day.status === "break") return "Break";
  return "—";
}

export function HabitSparklineRow({
  days,
  color,
  isNever,
  onDayClick,
}: {
  days: HeatmapDay[];
  color: string;
  isNever?: boolean;
  onDayClick?: (dateStr: string) => void;
}) {
  const { tooltip, visible, show } = useFloatingTooltip();
  const containerRef = useRef<HTMLDivElement>(null);

  if (days.length === 0) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>, day: HeatmapDay) => {
    onDayClick?.(day.dateStr);
    const cRect = containerRef.current?.getBoundingClientRect();
    const eRect = e.currentTarget.getBoundingClientRect();
    show(
      eRect.left - (cRect?.left ?? 0) + eRect.width / 2,
      eRect.top - (cRect?.top ?? 0),
      sparklineTooltip(day, isNever),
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex w-full gap-[2px]">
        {days.map((day) => {
          const off = day.isBeforeCreation || day.status === "not_scheduled";
          const done = day.status === "done";
          const failed = day.status === "missed" || day.status === "slip";

          return (
            <div
              key={day.dateStr}
              className={cn(
                "aspect-square min-w-0 flex-1 cursor-pointer rounded-[2px]",
                off && "bg-muted",
                failed && "border border-muted-foreground/50 bg-transparent",
                done && !off && !failed,
              )}
              style={done && !off ? { backgroundColor: color } : undefined}
              onClick={(e) => handleClick(e, day)}
            />
          );
        })}
      </div>
      {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
    </div>
  );
}
