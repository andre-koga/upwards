import { useRef } from "react";
import { formatDuration } from "@/lib/stats/format";
import { FloatingTooltip } from "./floating-tooltip";
import { useFloatingTooltip } from "./use-floating-tooltip";

const MAX_BAR_HEIGHT_PX = 48;

export function WeekdayBarChart({
  weekdayTimerMs,
  weekdayCompletion,
  color,
}: {
  weekdayTimerMs?: number[];
  weekdayCompletion?: [number, number][];
  color: string;
}) {
  const { tooltip, visible, show } = useFloatingTooltip();
  const containerRef = useRef<HTMLDivElement>(null);
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const reveal = (el: HTMLElement, text: string) => {
    const cRect = containerRef.current?.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    show(
      eRect.left - (cRect?.left ?? 0) + eRect.width / 2,
      eRect.top - (cRect?.top ?? 0),
      text
    );
  };

  const maxMs = weekdayTimerMs ? Math.max(...weekdayTimerMs, 1) : 1;

  const summary = weekdayTimerMs
    ? dayNames
        .map((name, i) => `${name}: ${formatDuration(weekdayTimerMs[i])}`)
        .join(". ")
    : dayNames
        .map((name, i) => {
          const [done, scheduled] = weekdayCompletion![i];
          const pct = scheduled > 0 ? Math.round((done / scheduled) * 100) : 0;
          return `${name}: ${pct}%`;
        })
        .join(". ");

  return (
    <div ref={containerRef} className="relative">
      <p className="sr-only">{summary}</p>
      <div
        className="flex w-full items-end gap-1.5"
        style={{ height: MAX_BAR_HEIGHT_PX + 20 }}
        role="list"
        aria-label="Weekday chart"
      >
        {Array.from({ length: 7 }).map((_, i) => {
          let barHeight: number;
          let bgClass: string;
          let customColor: string | undefined;
          let tooltipText: string;

          if (weekdayTimerMs) {
            const ms = weekdayTimerMs[i];
            barHeight =
              ms > 0
                ? Math.max(4, Math.round((ms / maxMs) * MAX_BAR_HEIGHT_PX))
                : 3;
            bgClass = ms > 0 ? "bg-foreground" : "bg-muted";
            customColor = ms > 0 ? color : undefined;
            tooltipText = formatDuration(ms);
          } else {
            const [done, scheduled] = weekdayCompletion![i];
            const ratio = scheduled > 0 ? done / scheduled : 0;
            barHeight =
              scheduled > 0
                ? Math.max(4, Math.round(ratio * MAX_BAR_HEIGHT_PX))
                : 3;
            bgClass = scheduled === 0 ? "bg-muted" : "bg-foreground";
            customColor = scheduled > 0 ? color : undefined;
            const pct = scheduled > 0 ? Math.round(ratio * 100) : 0;
            tooltipText = `${pct}%`;
          }

          return (
            <div
              key={i}
              className="flex flex-1 flex-col items-center gap-1"
              role="listitem"
            >
              <button
                type="button"
                className={`w-full cursor-pointer rounded-sm ${bgClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                style={{ height: barHeight, backgroundColor: customColor }}
                aria-label={`${dayNames[i]}: ${tooltipText}`}
                onClick={(e) => reveal(e.currentTarget, tooltipText)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    reveal(e.currentTarget, tooltipText);
                  }
                }}
              />
              <span className="text-[10px] text-muted-foreground" aria-hidden>
                {dayLabels[i]}
              </span>
            </div>
          );
        })}
      </div>
      {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
    </div>
  );
}
