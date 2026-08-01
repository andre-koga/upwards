import { useMemo, useRef } from "react";
import type { CompoundScorePoint } from "@/lib/activity";
import { formatCompoundScore } from "@/lib/activity";
import { formatWeekdayShortDate, fromDateString } from "@/lib/time-utils";
import { CHART_POINT_RADIUS } from "./chart-constants";
import { FloatingTooltip } from "./floating-tooltip";
import { useFloatingTooltip } from "./use-floating-tooltip";

const CHART_HEIGHT = 112;
const CHART_WIDTH = 300;
const PAD = { top: 8, right: 6, bottom: 24, left: 28 };

function formatAxisScore(score: number): string {
  return score.toFixed(2);
}

function pickXLabels(
  points: CompoundScorePoint[]
): { index: number; label: string }[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [
      {
        index: 0,
        label: formatWeekdayShortDate(fromDateString(points[0].dateStr)),
      },
    ];
  }
  const indices = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return [...new Set(indices)].map((index) => ({
    index,
    label: formatWeekdayShortDate(fromDateString(points[index].dateStr)),
  }));
}

function pickYTicks(min: number, max: number): number[] {
  const ticks = new Set<number>();
  ticks.add(min);
  ticks.add(max);
  if (min < 1 && max > 1) ticks.add(1);
  return [...ticks].sort((a, b) => a - b);
}

export function ScoreLineChart({
  points,
  color,
}: {
  points: CompoundScorePoint[];
  color: string;
}) {
  const { tooltip, visible, show } = useFloatingTooltip();
  const containerRef = useRef<HTMLDivElement>(null);

  const chart = useMemo(() => {
    if (points.length === 0) return null;

    const scores = points.map((p) => p.score);
    const rawMin = Math.min(...scores);
    const rawMax = Math.max(...scores);
    const padding = Math.max((rawMax - rawMin) * 0.1, 0.02);
    const yMin = rawMin - padding;
    const yMax = rawMax + padding;
    const yRange = yMax - yMin || 1;

    const plotW = CHART_WIDTH - PAD.left - PAD.right;
    const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;

    const xAt = (i: number) =>
      PAD.left +
      (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const yAt = (score: number) =>
      PAD.top + plotH - ((score - yMin) / yRange) * plotH;

    const linePath = points
      .map((p, i) => {
        const cmd = `${xAt(i).toFixed(1)} ${yAt(p.score).toFixed(1)}`;
        return i === 0 ? `M ${cmd}` : `L ${cmd}`;
      })
      .join(" ");

    const yTicks = pickYTicks(rawMin, rawMax);
    const xLabels = pickXLabels(points);

    return { yMin, yMax, yAt, xAt, linePath, yTicks, xLabels };
  }, [points]);

  if (!chart) return null;

  const handlePointClick = (
    e: React.MouseEvent<SVGCircleElement>,
    point: CompoundScorePoint
  ) => {
    const cRect = containerRef.current?.getBoundingClientRect();
    const eRect = e.currentTarget.getBoundingClientRect();
    show(
      eRect.left - (cRect?.left ?? 0) + eRect.width / 2,
      eRect.top - (cRect?.top ?? 0),
      `${formatWeekdayShortDate(fromDateString(point.dateStr))} · ${formatCompoundScore(point.score)}`
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        aria-hidden
      >
        {chart.yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={chart.yAt(tick)}
              x2={CHART_WIDTH - PAD.right}
              y2={chart.yAt(tick)}
              className={
                tick === 1 ? "stroke-muted-foreground/40" : "stroke-border"
              }
              strokeWidth={1}
              strokeDasharray={tick === 1 ? "3 3" : undefined}
            />
            <text
              x={PAD.left - 3}
              y={chart.yAt(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[8px]"
            >
              {formatAxisScore(tick)}
            </text>
          </g>
        ))}
        <path
          d={chart.linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, i) => (
          <circle
            key={point.dateStr}
            cx={chart.xAt(i)}
            cy={chart.yAt(point.score)}
            r={CHART_POINT_RADIUS}
            fill={color}
            className="cursor-pointer"
            onClick={(e) => handlePointClick(e, point)}
          />
        ))}
        {chart.xLabels.map(({ index, label }) => (
          <text
            key={`${points[index].dateStr}-label`}
            x={chart.xAt(index)}
            y={CHART_HEIGHT - 5}
            textAnchor="middle"
            fontSize={10}
            className="fill-muted-foreground"
          >
            {label}
          </text>
        ))}
      </svg>
      {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
    </div>
  );
}
