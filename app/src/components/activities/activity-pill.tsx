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
      <div className={base}>
        <span className="flex flex-1 items-center gap-2 truncate px-4 text-left text-sm font-medium">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {name || (
            <span className="font-normal text-muted-foreground/50">
              Name...
            </span>
          )}
        </span>
        <div
          className="relative mr-0.5 flex h-9 flex-shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold"
          style={{ backgroundColor: color, color: textColor }}
        >
          {actionContent}
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
            <span className="font-normal text-muted-foreground/50">Name...</span>
          )}
        </span>
      </Button>
      {onManualEntry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onManualEntry}
          className="relative h-full w-10 shrink-0 rounded-full p-0 shadow-none"
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
  );
}
