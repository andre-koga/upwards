import { memo, useMemo } from "react";
import { Play, Square } from "lucide-react";
import { formatTimerDisplay } from "@/lib/activity-utils";

// Memoize expensive color calculation
function getContrastColor(hex: string): "#000000" | "#ffffff" {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#000000" : "#ffffff";
}

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
          "flex-1 text-left font-medium truncate px-4 text-sm " + nameClassName
        }
      >
        {name || (
          <span className="text-muted-foreground/50 font-normal">Name…</span>
        )}
      </span>
      {/* Gradient fade from button colour to transparent */}
      <div
        className="absolute inset-y-0 right-0.5 w-full my-0.5 pointer-events-none rounded-r-full"
        style={{
          background: `linear-gradient(to left, ${color}, transparent 35%)`,
        }}
      />
      <div
        className="h-9 flex items-center justify-center flex-shrink-0 mr-0.5 relative rounded-full px-3 gap-2"
        style={{ backgroundColor: color }}
      >
        {isRunning ? (
          <Square
            className="h-3 w-3 flex-shrink-0"
            style={{ color: textColor, fill: textColor }}
          />
        ) : (
          <Play
            className="h-3 w-3 translate-x-px flex-shrink-0"
            style={{ color: textColor, fill: textColor }}
          />
        )}
        <span
          className="text-xs flex-shrink-0"
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
