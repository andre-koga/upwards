import { useMemo } from "react";
import { formatDuration } from "@/lib/stats/format";
import { cn } from "@/lib/utils";

export interface HorizontalBarItem {
  id: string;
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
  subtitle?: string;
}

function formatBarValue(value: number, max: number): string {
  if (value >= 60_000) return formatDuration(value);
  if (max <= 100) return `${Math.round(value)}%`;
  return String(Math.round(value));
}

export function HorizontalBarChart({
  items,
  color,
  onItemClick,
}: {
  items: HorizontalBarItem[];
  color: string;
  onItemClick?: (id: string) => void;
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.value - a.value),
    [items],
  );

  const scaleMax = useMemo(
    () => Math.max(...items.map((i) => i.maxValue ?? i.value), 1),
    [items],
  );

  if (sorted.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((item) => {
        const barMax = item.maxValue ?? scaleMax;
        const pct = barMax > 0 ? Math.min(100, (item.value / barMax) * 100) : 0;
        const barColor = item.color ?? color;
        const displayValue = item.subtitle ?? formatBarValue(item.value, scaleMax);
        const interactive = !!onItemClick;

        return (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex w-full flex-col gap-1 text-left",
              interactive && "cursor-pointer",
            )}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            disabled={!interactive}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">{item.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {displayValue}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
