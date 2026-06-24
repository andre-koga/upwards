import { useRef } from "react";
import type { MonthlyCompletionPoint, MonthlyCompletionSeries } from "@/lib/stats";
import { FloatingTooltip, useFloatingTooltip } from "./use-floating-tooltip";

const MONTHLY_CHART_HEIGHT = 112;
const MONTHLY_CHART_WIDTH = 300;
const MONTHLY_PAD = { top: 8, right: 6, bottom: 24, left: 18 };

function buildLineSegments(
  points: MonthlyCompletionPoint[],
  xAt: (i: number) => number,
  yAt: (rate: number) => number,
): string[] {
  const segments: string[] = [];
  let segment: string[] = [];
  points.forEach((p, i) => {
    if (p.rate === null) {
      if (segment.length) {
        segments.push(segment.join(" "));
        segment = [];
      }
      return;
    }
    const cmd = `${xAt(i).toFixed(1)} ${yAt(p.rate).toFixed(1)}`;
    segment.push(segment.length === 0 ? `M ${cmd}` : `L ${cmd}`);
  });
  if (segment.length) segments.push(segment.join(" "));
  return segments;
}

function formatPointTooltip(
  seriesLabel: string | undefined,
  p: MonthlyCompletionPoint,
): string {
  if (p.rate === null) return "";
  if (seriesLabel) return `${seriesLabel} · ${p.rate}%`;
  return `${p.rate}%`;
}

export function MonthlyLineChart({
  points,
  color,
  series,
  isNever,
}: {
  points?: MonthlyCompletionPoint[];
  color?: string;
  series?: MonthlyCompletionSeries[];
  isNever?: boolean;
}) {
  const { tooltip, visible, show } = useFloatingTooltip();
  const containerRef = useRef<HTMLDivElement>(null);

  const chartSeries: MonthlyCompletionSeries[] =
    series && series.length > 0
      ? series
      : points && color
        ? [{ id: "default", label: "", color, points }]
        : [];

  if (chartSeries.length === 0) return null;

  const monthLabels = chartSeries[0].points;
  const plotW = MONTHLY_CHART_WIDTH - MONTHLY_PAD.left - MONTHLY_PAD.right;
  const plotH = MONTHLY_CHART_HEIGHT - MONTHLY_PAD.top - MONTHLY_PAD.bottom;
  const multiSeries = chartSeries.length > 1;

  const xAt = (i: number) =>
    MONTHLY_PAD.left +
    (monthLabels.length <= 1 ? plotW / 2 : (i / (monthLabels.length - 1)) * plotW);
  const yAt = (rate: number) => MONTHLY_PAD.top + plotH - (rate / 100) * plotH;

  const handlePointClick = (
    e: React.MouseEvent<SVGCircleElement>,
    p: MonthlyCompletionPoint,
    seriesLabel?: string,
  ) => {
    const text = formatPointTooltip(seriesLabel, p);
    if (!text) return;
    const cRect = containerRef.current?.getBoundingClientRect();
    const eRect = e.currentTarget.getBoundingClientRect();
    show(
      eRect.left - (cRect?.left ?? 0) + eRect.width / 2,
      eRect.top - (cRect?.top ?? 0),
      text,
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${MONTHLY_CHART_WIDTH} ${MONTHLY_CHART_HEIGHT}`}
        className="w-full"
        aria-hidden
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={MONTHLY_PAD.left}
              y1={yAt(tick)}
              x2={MONTHLY_CHART_WIDTH - MONTHLY_PAD.right}
              y2={yAt(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={MONTHLY_PAD.left - 3}
              y={yAt(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[8px]"
            >
              {tick}
            </text>
          </g>
        ))}
        {chartSeries.map((s) =>
          buildLineSegments(s.points, xAt, yAt).map((d, i) => (
            <path
              key={`${s.id}-${i}`}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={multiSeries ? 1.75 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )),
        )}
        {chartSeries.map((s) =>
          s.points.map((p, i) =>
            p.rate === null ? null : (
              <circle
                key={`${s.id}-${p.monthKey}`}
                cx={xAt(i)}
                cy={yAt(p.rate)}
                r={multiSeries ? 2.5 : 3}
                fill={s.color}
                className="cursor-pointer"
                onClick={(e) => handlePointClick(e, p, s.label || undefined)}
              />
            ),
          ),
        )}
        {monthLabels.map((p, i) => (
          <text
            key={`${p.monthKey}-label`}
            x={xAt(i)}
            y={MONTHLY_CHART_HEIGHT - 5}
            textAnchor="middle"
            fontSize={10}
            className="fill-muted-foreground"
          >
            {p.label}
          </text>
        ))}
      </svg>
      {multiSeries && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {chartSeries.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
      {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
    </div>
  );
}
