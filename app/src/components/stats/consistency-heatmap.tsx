import { useRef } from "react";
import type { HeatmapDay } from "@/lib/stats";
import { formatDuration } from "@/lib/stats/format";
import { cn } from "@/lib/utils";
import { THEME_PRIMARY_COLOR } from "@/lib/color-utils";
import { FloatingTooltip, useFloatingTooltip } from "./use-floating-tooltip";

type CellKind =
  | "no_count"
  | "break"
  | "success"
  | "failure"
  | "timer_empty"
  | "timer_filled"
  | "aggregate_off"
  | "aggregate_outline"
  | "aggregate_fill";

interface CellPresentation {
  kind: CellKind;
  intensity: number;
  interactive: boolean;
  breakDot?: boolean;
  fillOpacity?: number;
}

const HEATMAP_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function mondayFirstIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function isWeekdayDate(dateStr: string): boolean {
  return mondayFirstIndex(new Date(dateStr + "T00:00:00")) < 5;
}

function getActivityCellPresentation(
  day: HeatmapDay,
  maxMs: number,
  hasRoutine: boolean,
): CellPresentation {
  const ms = day.ms ?? 0;
  const status = day.status;
  const timeOpacity = ms > 0 ? Math.max(0.15, ms / maxMs) : undefined;
  const hasFailed = status === "missed" || status === "slip";

  if (day.isBeforeCreation || status === "not_scheduled") {
    return { kind: "no_count", intensity: 0, interactive: true };
  }

  if (status === "break") {
    return { kind: "break", intensity: 0, interactive: true };
  }

  if (hasRoutine) {
    if (hasFailed) {
      return {
        kind: "failure",
        intensity: 0,
        interactive: true,
        fillOpacity: timeOpacity,
      };
    }
    if (status === "done") {
      return {
        kind: "success",
        intensity: 0,
        interactive: true,
        breakDot: day.isBreakDay,
        fillOpacity: timeOpacity,
      };
    }
  }

  if (ms > 0) {
    return {
      kind: "timer_filled",
      intensity: 0,
      interactive: true,
      fillOpacity: timeOpacity,
    };
  }
  return { kind: "timer_empty", intensity: 0, interactive: true };
}

function getAggregateCellPresentation(day: HeatmapDay): CellPresentation {
  const rate = day.completionRate;
  if (day.isBeforeCreation || rate === undefined || day.status === "not_scheduled") {
    return { kind: "aggregate_off", intensity: 0, interactive: true };
  }
  if (rate === 0) {
    return { kind: "aggregate_outline", intensity: 0, interactive: true };
  }
  if (rate === 100) {
    return { kind: "aggregate_fill", intensity: 1, interactive: true, fillOpacity: 1 };
  }
  return {
    kind: "aggregate_fill",
    intensity: rate / 100,
    interactive: true,
    fillOpacity: rate / 100,
  };
}

function getActivityTooltipText(day: HeatmapDay, isNever: boolean): string {
  if (day.isBeforeCreation || day.status === "not_scheduled") return "Off";

  const ms = day.ms ?? 0;
  const status = day.status;

  if (ms > 0) return formatDuration(ms);

  if (day.isBreakDay && status === "done") return "Break";
  if (status === "break") return "Break";
  if (status === "done") return isNever ? "Clean" : "Done";
  if (status === "slip") return "Slip";
  if (status === "missed") return "Missed";
  return "—";
}

function getAggregateTooltipText(day: HeatmapDay): string {
  const rate = day.completionRate;
  if (day.isBeforeCreation || rate === undefined || day.status === "not_scheduled") {
    return "Off";
  }
  return `${rate}%`;
}

function buildDowRows(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  const firstDow = mondayFirstIndex(new Date(days[0].dateStr + "T00:00:00"));
  const padded: (HeatmapDay | null)[] = [...Array<null>(firstDow).fill(null), ...days];
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  const rows: (HeatmapDay | null)[][] = Array.from({ length: 7 }, () => []);
  for (const week of weeks) {
    for (let dow = 0; dow < 7; dow++) {
      rows[dow].push(week[dow] ?? null);
    }
  }
  return rows;
}

function BreakDayDot({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <span className="h-1 w-1 rounded-full bg-foreground" />
    </div>
  );
}

function TimeWeightedFill({
  color,
  fillOpacity,
  className,
}: {
  color: string;
  fillOpacity: number;
  className?: string;
}) {
  return (
    <div
      className={cn("absolute inset-[0.5px] rounded-[2px]", className)}
      style={{ backgroundColor: color, opacity: fillOpacity }}
    />
  );
}

function CellBackground({
  className,
  style,
  dimmed,
}: {
  className?: string;
  style?: React.CSSProperties;
  dimmed?: boolean;
}) {
  return (
    <div
      className={cn("absolute inset-0 rounded-[2px]", dimmed && "opacity-50", className)}
      style={style}
      aria-hidden
    />
  );
}

function HeatmapCell({
  presentation,
  color,
  aggregateFillColor,
  weekdayDimmed,
  onClick,
}: {
  presentation: CellPresentation;
  color: string;
  aggregateFillColor?: string;
  weekdayDimmed?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const { kind, intensity, interactive } = presentation;
  const base = cn(
    "relative aspect-square w-full overflow-hidden rounded-[2px]",
    interactive && "cursor-pointer",
  );

  if (kind === "no_count" || kind === "aggregate_off") {
    return (
      <div className={base} onClick={onClick}>
        <CellBackground
          dimmed={weekdayDimmed}
          className="border border-muted-foreground/50 bg-transparent"
        />
      </div>
    );
  }

  if (kind === "break") {
    return (
      <div className={base} onClick={onClick}>
        <CellBackground dimmed={weekdayDimmed} className="bg-muted" />
        <BreakDayDot />
      </div>
    );
  }

  if (kind === "success") {
    return (
      <div className={base} onClick={onClick}>
        {presentation.fillOpacity != null ? (
          <CellBackground className="bg-muted/25" />
        ) : (
          <CellBackground style={{ backgroundColor: color }} />
        )}
        {presentation.fillOpacity != null && (
          <TimeWeightedFill color={color} fillOpacity={presentation.fillOpacity} />
        )}
        {presentation.breakDot && <BreakDayDot />}
      </div>
    );
  }

  if (kind === "failure" || kind === "aggregate_outline") {
    if (presentation.fillOpacity != null) {
      return (
        <div className={base} onClick={onClick}>
          <CellBackground dimmed={weekdayDimmed} className="bg-muted/25" />
          <div className={cn("absolute inset-0", weekdayDimmed && "opacity-50")}>
            <TimeWeightedFill color={color} fillOpacity={presentation.fillOpacity} />
          </div>
        </div>
      );
    }
    return (
      <div className={base} onClick={onClick}>
        <CellBackground dimmed={weekdayDimmed} className="bg-muted" />
      </div>
    );
  }

  if (kind === "aggregate_fill") {
    return (
      <div className={base} onClick={onClick}>
        <CellBackground className="bg-muted/25" />
        <div
          className={cn(
            "absolute inset-[0.5px] rounded-[2px]",
            !aggregateFillColor && "bg-foreground",
          )}
          style={{
            ...(aggregateFillColor ? { backgroundColor: aggregateFillColor } : {}),
            opacity: presentation.fillOpacity ?? 1,
          }}
        />
      </div>
    );
  }

  if (kind === "timer_filled") {
    return (
      <div className={base} onClick={onClick}>
        <CellBackground className="bg-muted/25" />
        <TimeWeightedFill
          color={color}
          fillOpacity={presentation.fillOpacity ?? 1}
        />
      </div>
    );
  }

  return (
    <div className={base} onClick={onClick}>
      <CellBackground className="bg-muted/25" />
    </div>
  );
}

function LegendSwatch({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center overflow-hidden rounded-[2px]">
      {children}
    </span>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      {swatch}
      {label}
    </span>
  );
}

function ActivityHeatmapLegend({ color, isNever }: { color: string; isNever: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <LegendItem
        swatch={
          <LegendSwatch>
            <span className="h-full w-full" style={{ backgroundColor: color }} />
          </LegendSwatch>
        }
        label={isNever ? "Clean" : "Done"}
      />
      <LegendItem
        swatch={
          <LegendSwatch>
            <span className="h-full w-full bg-muted" />
          </LegendSwatch>
        }
        label={isNever ? "Slip" : "Missed"}
      />
      {!isNever && (
        <LegendItem
          swatch={
            <LegendSwatch>
              <span className="relative h-full w-full bg-muted">
                <BreakDayDot />
              </span>
            </LegendSwatch>
          }
          label="Break"
        />
      )}
      <LegendItem
        swatch={
          <LegendSwatch>
            <span className="h-full w-full border border-muted-foreground/50 bg-transparent" />
          </LegendSwatch>
        }
        label="Off"
      />
    </div>
  );
}

function AggregateHeatmapLegend({ fillColor }: { fillColor?: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <LegendItem
        swatch={
          <LegendSwatch>
            {fillColor ? (
              <span
                className="h-full w-full"
                style={{ backgroundColor: fillColor, opacity: 0.35 }}
              />
            ) : (
              <span className="h-full w-full bg-foreground opacity-35" />
            )}
          </LegendSwatch>
        }
        label="Low"
      />
      <LegendItem
        swatch={
          <LegendSwatch>
            {fillColor ? (
              <span className="h-full w-full" style={{ backgroundColor: fillColor }} />
            ) : (
              <span className="h-full w-full bg-foreground" />
            )}
          </LegendSwatch>
        }
        label="High"
      />
      <LegendItem
        swatch={
          <LegendSwatch>
            <span className="h-full w-full border border-muted-foreground/50 bg-transparent" />
          </LegendSwatch>
        }
        label="Off"
      />
    </div>
  );
}

export function ConsistencyHeatmap({
  days,
  color = THEME_PRIMARY_COLOR,
  aggregateColor,
  mode,
  isNever = false,
  hasRoutine = true,
}: {
  days: HeatmapDay[];
  color?: string;
  /** Aggregate high/low fill; defaults to foreground when omitted */
  aggregateColor?: string;
  mode: "activity" | "aggregate";
  isNever?: boolean;
  hasRoutine?: boolean;
}) {
  const { tooltip, visible, show } = useFloatingTooltip();
  const containerRef = useRef<HTMLDivElement>(null);

  if (days.length === 0) return null;

  const maxMs = Math.max(...days.map((d) => d.ms ?? 0), 1);

  const getTooltip = (day: HeatmapDay) =>
    mode === "aggregate"
      ? getAggregateTooltipText(day)
      : getActivityTooltipText(day, isNever);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>, day: HeatmapDay) => {
    const cRect = containerRef.current?.getBoundingClientRect();
    const eRect = e.currentTarget.getBoundingClientRect();
    show(
      eRect.left - (cRect?.left ?? 0) + eRect.width / 2,
      eRect.top - (cRect?.top ?? 0),
      getTooltip(day),
    );
  };

  const renderCell = (day: HeatmapDay) => {
    const presentation =
      mode === "aggregate"
        ? getAggregateCellPresentation(day)
        : getActivityCellPresentation(day, maxMs, hasRoutine);
    const weekdayDimmed =
      isWeekdayDate(day.dateStr) &&
      (presentation.kind === "no_count" ||
        presentation.kind === "aggregate_off" ||
        presentation.kind === "failure" ||
        presentation.kind === "aggregate_outline" ||
        presentation.kind === "break");
    return (
      <HeatmapCell
        presentation={presentation}
        color={color}
        aggregateFillColor={mode === "aggregate" ? aggregateColor : undefined}
        weekdayDimmed={weekdayDimmed}
        onClick={presentation.interactive ? (e) => handleClick(e, day) : undefined}
      />
    );
  };

  const legend =
    mode === "aggregate" ? (
      <AggregateHeatmapLegend fillColor={aggregateColor} />
    ) : hasRoutine ? (
      <ActivityHeatmapLegend color={color} isNever={isNever} />
    ) : null;

  if (days.length <= 7) {
    return (
      <div ref={containerRef} className="relative">
        <div className="flex w-full gap-[3px]">
          {days.map((day) => (
            <div key={day.dateStr} className="flex flex-1 flex-col gap-0.5">
              {renderCell(day)}
            </div>
          ))}
        </div>
        {legend}
        {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
      </div>
    );
  }

  const rows = buildDowRows(days);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex w-full flex-col gap-[3px]">
        {rows.map((row, dow) => {
          const isWeekendLabel = dow === 5 || dow === 6;
          return (
            <div key={dow} className="flex w-full gap-[3px]">
              <div
                className={cn(
                  "flex w-3 shrink-0 items-center justify-center text-[10px] leading-none text-muted-foreground",
                  isWeekendLabel && "font-bold",
                )}
              >
                {HEATMAP_DAY_LABELS[dow]}
              </div>
              <div className="flex min-w-0 flex-1 gap-[3px]">
                {row.map((day, wi) => (
                  <div key={wi} className="min-w-0 flex-1">
                    {day ? renderCell(day) : <div className="aspect-square w-full" />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {legend}
      {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
    </div>
  );
}
