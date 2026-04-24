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
  /** When true, renders as a non-interactive div instead of a button */
  readOnly?: boolean;
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
  className = "",
}: ActivityPillProps) {
  const textColor = getContrastColor(color);
  const timerLabel = formatTimerDisplay(elapsedMs);
  const base =
    "relative flex items-stretch gap-2 rounded-full overflow-hidden h-10 " +
    className;

  const actionContent = (
    <>
      {isRunning ? (
        <Square className="h-3.5 w-3.5 shrink-0" style={{ fill: textColor }} />
      ) : (
        <Play className="h-3.5 w-3.5 shrink-0 translate-x-px fill-secondary-foreground" />
      )}
      <span className="font-mono text-xs opacity-80">{timerLabel}</span>
    </>
  );

  if (readOnly) {
    return (
      <div className={base + " w-full"}>
        <div className="pointer-events-none flex h-full min-w-0 flex-1 items-center justify-start gap-2 truncate rounded-full border border-input bg-background px-4 text-left text-sm font-medium text-foreground shadow-sm">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {name ? (
            <span className={cn("min-w-0 truncate", nameClassName)}>
              {name}
            </span>
          ) : (
            <span className="min-w-0 font-normal text-muted-foreground/50">
              Name…
            </span>
          )}
        </div>
        <div className="flex h-full min-h-0 items-stretch">
          <div
            className={cn(
              "relative flex h-full shrink-0 items-center justify-center gap-1.5 rounded-full border bg-background px-4 text-xs font-semibold",
              isRunning ? "border-2" : "border-border text-muted-foreground"
            )}
            style={
              isRunning ? { borderColor: color, color: textColor } : undefined
            }
          >
            {isRunning ? (
              <>
                <Square
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ fill: textColor }}
                />
                <span className="font-mono text-xs opacity-80">
                  {timerLabel}
                </span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 shrink-0 translate-x-px fill-muted-foreground" />
                <span className="font-mono text-xs opacity-80">
                  {timerLabel}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={base + " w-full"}>
      <Button
        type="button"
        variant="outline"
        onClick={onNameClick}
        className="h-full flex-1 justify-start gap-2 truncate rounded-full px-4 text-left text-sm font-medium shadow-none hover:bg-transparent"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className={cn("truncate", nameClassName)}>
          {name || (
            <span className="font-normal text-muted-foreground/50">
              Name...
            </span>
          )}
        </span>
      </Button>
      <div>
        {onManualEntry ? (
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
        <Button
          type="button"
          variant="secondary"
          onClick={onClick}
          className="relative h-full shrink-0 gap-1.5 rounded-full px-4 font-semibold shadow-none"
          style={
            isRunning ? { backgroundColor: color, color: textColor } : undefined
          }
        >
          {actionContent}
        </Button>
      </div>
    </div>
  );
}
