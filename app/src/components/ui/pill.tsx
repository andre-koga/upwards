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
  /** When provided, name area opens this instead of triggering onPlayStop; only the play button triggers onPlayStop */
  onNameClick?: () => void;
  nameClassName?: string;
  /** When true, renders as a non-interactive div instead of a button */
  readOnly?: boolean;
  size?: "default" | "sm";
  className?: string;
}

function Pill({
  name,
  color = "#3b82f6",
  elapsedMs = 0,
  isRunning = false,
  onPlayStop,
  onNameClick,
  nameClassName = "",
  readOnly = false,
  size = "default",
  className = "",
}: PillProps) {
  const textColor = useMemo(() => getContrastColor(color), [color]);
  const isSm = size === "sm";

  const playTimerButton = (
    <div
      className={
        "relative flex h-full flex-shrink-0 items-center justify-center gap-2 rounded-full " +
        (isSm ? "px-2" : "px-3")
      }
      style={{ backgroundColor: color }}
    >
      {isRunning ? (
        <Square
          className={
            isSm ? "h-2.5 w-2.5 flex-shrink-0" : "h-3 w-3 flex-shrink-0"
          }
          style={{ color: textColor, fill: textColor }}
        />
      ) : (
        <Play
          className={
            isSm
              ? "h-2.5 w-2.5 flex-shrink-0 translate-x-px"
              : "h-3 w-3 flex-shrink-0 translate-x-px"
          }
          style={{ color: textColor, fill: textColor }}
        />
      )}
      <span
        className={
          "flex-shrink-0 " + (isSm ? "mt-[1px] text-[10px]" : "mt-0.5 text-xs")
        }
        style={{ color: textColor, fontFamily: "JetBrains Mono, monospace" }}
      >
        {formatTimerDisplay(elapsedMs)}
      </span>
    </div>
  );

  const nameContent = (
    <>
      <span
        className={
          "flex-1 truncate text-left font-medium " +
          (isSm ? "px-3 text-xs" : "px-4 text-sm") +
          (nameClassName ? " " + nameClassName : "")
        }
      >
        {name || (
          <span className="font-normal text-muted-foreground/50">Name…</span>
        )}
      </span>
      {/* Gradient fade from button colour to transparent */}
      <div
        className={
          "pointer-events-none absolute inset-y-0 right-0.5 w-full rounded-r-full"
        }
        style={{
          background: isSm
            ? `linear-gradient(to left, ${color}, transparent 28%)`
            : `linear-gradient(to left, ${color}, transparent 35%)`,
        }}
      />
    </>
  );

  const base =
    "relative flex items-center border border-border rounded-full overflow-hidden " +
    (isSm ? "h-8 " : "h-10 ") +
    className;

  if (readOnly) {
    return (
      <div className={base}>
        {nameContent}
        {playTimerButton}
      </div>
    );
  }

  if (onNameClick) {
    return (
      <div className={base + " w-full"}>
        <button
          type="button"
          onClick={onNameClick}
          className="flex min-w-0 flex-1 items-center text-left"
        >
          {nameContent}
        </button>
        <button
          type="button"
          onClick={onPlayStop}
          className="h-full flex-shrink-0"
        >
          {playTimerButton}
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={onPlayStop} className={base + " w-full"}>
      {nameContent}
      {playTimerButton}
    </button>
  );
}

export default memo(Pill);
