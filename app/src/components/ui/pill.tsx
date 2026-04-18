import { memo } from "react";
import type { MouseEventHandler, PointerEventHandler } from "react";
import { Play, Plus, Square } from "lucide-react";
import { formatTimerDisplay } from "@/lib/activity";
import { getContrastColor } from "@/lib/color-utils";
import { Button } from "@/components/ui/button";

export interface PillProps {
  name: string;
  color?: string;
  textColor?: string;
  elapsedMs?: number;
  isRunning?: boolean;
  onPlayStop?: () => void;
  onManualEntry?: () => void;
  /** When provided, name area opens this instead of triggering onPlayStop; only the play button triggers onPlayStop */
  onNameClick?: () => void;
  onNamePointerDown?: PointerEventHandler<HTMLButtonElement>;
  onNamePointerUp?: PointerEventHandler<HTMLButtonElement>;
  onNamePointerLeave?: PointerEventHandler<HTMLButtonElement>;
  onNamePointerCancel?: PointerEventHandler<HTMLButtonElement>;
  onNameContextMenu?: MouseEventHandler<HTMLButtonElement>;
  nameClassName?: string;
  /** When true, renders as a non-interactive div instead of a button */
  readOnly?: boolean;
  size?: "default" | "sm";
  className?: string;
}

function Pill({
  name,
  color = "#3b82f6",
  textColor,
  elapsedMs = 0,
  isRunning = false,
  onPlayStop,
  onManualEntry,
  onNameClick,
  onNamePointerDown,
  onNamePointerUp,
  onNamePointerLeave,
  onNamePointerCancel,
  onNameContextMenu,
  nameClassName = "",
  readOnly = false,
  size = "default",
  className = "",
}: PillProps) {
  const resolvedTextColor = textColor ?? getContrastColor(color);
  const resolvedRunningColor = isRunning ? resolvedTextColor : "";
  const bgColor = isRunning ? color : "";
  const isSm = size === "sm";

  const playTimerButton = (
    <div
      className={
        "relative flex h-full flex-shrink-0 items-center justify-center gap-2 rounded-full bg-secondary text-secondary-foreground transition-all " +
        (isSm ? "px-2" : "px-3")
      }
      style={{ backgroundColor: bgColor }}
    >
      {isRunning ? (
        <Square
          className={
            isSm ? "h-2.5 w-2.5 flex-shrink-0" : "h-3 w-3 flex-shrink-0"
          }
          style={{ color: resolvedTextColor, fill: resolvedTextColor }}
        />
      ) : (
        <Play
          className={
            isSm
              ? "h-2.5 w-2.5 flex-shrink-0 translate-x-px fill-foreground"
              : "h-3 w-3 flex-shrink-0 translate-x-px fill-secondary-foreground"
          }
        />
      )}
      <span
        className={
          "flex-shrink-0 font-mono " +
          (isSm ? "mt-[1px] text-[10px]" : "mt-0.5 text-xs")
        }
        style={{
          color: resolvedRunningColor,
        }}
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
          (isSm ? "px-2 text-xs" : "px-3 text-sm") +
          (nameClassName ? " " + nameClassName : "")
        }
      >
        {name || (
          <span className="font-normal text-muted-foreground/50">Name…</span>
        )}
      </span>
    </>
  );

  const base =
    "relative flex items-center overflow-hidden " +
    (isSm ? "h-8 " : "h-10 ") +
    className;

  const timerControl = onPlayStop ? (
    <Button
      type="button"
      variant="ghost"
      onClick={onPlayStop}
      className="h-full shrink-0 rounded-none p-0 shadow-none hover:bg-transparent focus-visible:ring-offset-0"
    >
      {playTimerButton}
    </Button>
  ) : (
    <div className="h-full flex-shrink-0">{playTimerButton}</div>
  );

  const manualEntryControl = onManualEntry ? (
    <Button
      type="button"
      variant="ghost"
      onClick={onManualEntry}
      className="-mr-1 h-full w-10 shrink-0 p-0 shadow-none hover:bg-muted/30 focus-visible:ring-offset-0"
      title="Add manual time entry"
      aria-label="Add manual time entry"
    >
      <Plus className="h-3.5 w-3.5" />
    </Button>
  ) : null;

  if (readOnly) {
    return (
      <div className={base}>
        {nameContent}
        {playTimerButton}
      </div>
    );
  }

  return (
    <div className={base + " w-full"}>
      <div
        className="ml-4 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {onNameClick ? (
        <Button
          type="button"
          variant="outline"
          onClick={onNameClick}
          onPointerDown={onNamePointerDown}
          onPointerUp={onNamePointerUp}
          onPointerLeave={onNamePointerLeave}
          onPointerCancel={onNamePointerCancel}
          onContextMenu={onNameContextMenu}
          className="h-full min-w-0 flex-1 justify-start border border-border p-0 text-left shadow-none hover:bg-transparent focus-visible:ring-offset-0"
        >
          {nameContent}
        </Button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center">{nameContent}</div>
      )}
      <div className="flex h-full rounded-full border border-border">
        {manualEntryControl}
        {timerControl}
      </div>
    </div>
  );
}

export default memo(Pill);
