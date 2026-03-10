import { memo, useMemo } from "react";
import { Play, Square } from "lucide-react";
import { formatTimerDisplay } from "@/lib/activity-utils";
import { getContrastColor } from "@/lib/color-utils";

export interface PillProps {
  name: string;
  color?: string;
  elapsedMs?: number;
  isRunning?: boolean;
  onPlayStop?: () => void;
  nameClassName?: string;
  /** When true, renders as a non-interactive div instead of a button */
  readOnly?: boolean;
  className?: string;
}

function Pill({
  name,
  color = "#3b82f6",
  elapsedMs = 0,
  isRunning = false,
  onPlayStop,
  nameClassName = "",
  readOnly = false,
  className = "",
}: PillProps) {
  const textColor = useMemo(() => getContrastColor(color), [color]);

  const inner = (
    <>
      <span
        className={
          "flex-1 truncate px-4 text-left text-sm font-medium " + nameClassName
        }
      >
        {name || (
          <span className="font-normal text-muted-foreground/50">Name…</span>
        )}
      </span>
      {/* Gradient fade from button colour to transparent */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0.5 my-0.5 w-full rounded-r-full"
        style={{
          background: `linear-gradient(to left, ${color}, transparent 35%)`,
        }}
      />
      <div
        className="relative mr-0.5 flex h-9 flex-shrink-0 items-center justify-center gap-2 rounded-full px-3"
        style={{ backgroundColor: color }}
      >
        {isRunning ? (
          <Square
            className="h-3 w-3 flex-shrink-0"
            style={{ color: textColor, fill: textColor }}
          />
        ) : (
          <Play
            className="h-3 w-3 flex-shrink-0 translate-x-px"
            style={{ color: textColor, fill: textColor }}
          />
        )}
        <span
          className="flex-shrink-0 text-xs"
          style={{ color: textColor, fontFamily: "JetBrains Mono, monospace" }}
        >
          {formatTimerDisplay(elapsedMs)}
        </span>
      </div>
    </>
  );

  const base =
    "relative flex items-center border border-border rounded-full overflow-hidden h-11 " +
    className;

  if (readOnly) {
    return <div className={base}>{inner}</div>;
  }

  return (
    <button type="button" onClick={onPlayStop} className={base + " w-full"}>
      {inner}
    </button>
  );
}

export default memo(Pill);
