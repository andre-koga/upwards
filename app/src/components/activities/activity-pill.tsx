import { Play, Plus, Square } from "lucide-react";
import { formatTimerDisplay } from "@/lib/activity";
import { getContrastColor } from "@/lib/color-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ActivityPillProps {
  name: string;
  color?: string;
  elapsedMs?: number;
  isRunning?: boolean;
  onNameClick?: () => void;
  onClick?: () => void;
  onManualEntry?: () => void;
  nameClassName?: string;
  /** When true, renders timer/play as non-interactive display instead of buttons. */
  readOnly?: boolean;
  /** When readOnly, still allow tapping the name (e.g. retired info on past days). */
  allowNameClickWhenReadOnly?: boolean;
  className?: string;
}

export default function ActivityPill({
  name,
  color = "#3b82f6",
  elapsedMs = 0,
  isRunning = false,
  onNameClick,
  onClick,
  onManualEntry,
  nameClassName = "",
  readOnly = false,
  allowNameClickWhenReadOnly = false,
  className = "",
}: ActivityPillProps) {
  const textColor = getContrastColor(color);
  const timerLabel = formatTimerDisplay(elapsedMs);
  const nameInteractive = !readOnly || allowNameClickWhenReadOnly;

  return (
    <div
      className={cn(
        "relative flex h-10 w-full items-stretch gap-2 overflow-hidden rounded-full",
        className,
      )}
    >
      {/* Name / label side */}
      <Button
        type="button"
        variant="outline"
        onClick={nameInteractive ? onNameClick : undefined}
        className={cn(
          "h-full min-h-0 flex-1 flex-col items-stretch justify-center gap-0 overflow-hidden rounded-full p-0 text-left text-sm font-medium",
          readOnly && !allowNameClickWhenReadOnly
            ? "pointer-events-none shadow-sm"
            : readOnly
              ? "shadow-sm"
              : "shadow-none",
        )}
      >
        <span
          className={cn(
            "flex min-h-0 min-w-0 flex-1 items-center gap-2 px-4 py-1",
          )}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className={cn("min-w-0 truncate", nameClassName)}>
            {name || (
              <span className="font-normal text-muted-foreground">Name…</span>
            )}
          </span>
        </span>
      </Button>

      {/* Timer / action side */}
      <div className="flex h-full min-h-0 items-stretch">
        {!readOnly && onManualEntry ? (
          <Button
            type="button"
            variant="outline"
            onClick={onManualEntry}
            className="relative -mr-4 h-full w-12 shrink-0 rounded-l-full border-r-0 pr-6 shadow-none"
            title="Add manual time entry"
            aria-label="Add manual time entry"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        ) : null}

        {readOnly ? (
          <div
            className={cn(
              "relative flex h-full shrink-0 items-center justify-center gap-1.5 rounded-full border bg-background px-4 text-xs font-semibold",
              isRunning ? "border-2" : "border-border text-muted-foreground",
            )}
            style={isRunning ? { borderColor: color, color: textColor } : undefined}
          >
            {isRunning ? (
              <Square className="h-3.5 w-3.5 shrink-0" style={{ fill: textColor }} />
            ) : (
              <Play className="h-3.5 w-3.5 shrink-0 translate-x-px fill-muted-foreground" />
            )}
            <span
              className={cn("font-mono text-xs", !isRunning && "text-muted-foreground")}
            >
              {timerLabel}
            </span>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={onClick}
            className="relative h-full shrink-0 gap-1.5 rounded-full px-4 font-semibold shadow-none"
            style={isRunning ? { backgroundColor: color, color: textColor } : undefined}
          >
            {isRunning ? (
              <Square className="h-3.5 w-3.5 shrink-0" style={{ fill: textColor }} />
            ) : (
              <Play className="h-3.5 w-3.5 shrink-0 translate-x-px fill-secondary-foreground" />
            )}
            <span className="font-mono text-xs">{timerLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
