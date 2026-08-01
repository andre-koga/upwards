import { Play, Plus, Square, Settings } from "lucide-react";
import { formatTimerDisplay } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR, getContrastColor } from "@/lib/color-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ActivityPillProps {
  name: string;
  color?: string;
  elapsedMs?: number;
  isRunning?: boolean;
  onNameClick?: () => void;
  /** Opens the activity stats dialog when clicking the pill name area. */
  onStatsClick?: () => void;
  onClick?: () => void;
  onManualEntry?: () => void;
  onSettingsClick?: () => void;
  nameClassName?: string;
  /** When true, renders timer/play as non-interactive display instead of buttons. */
  readOnly?: boolean;
  /** When readOnly, still allow tapping the name (e.g. retired info on past days). */
  allowNameClickWhenReadOnly?: boolean;
  className?: string;
}

export default function ActivityPill({
  name,
  color = DEFAULT_GROUP_COLOR,
  elapsedMs = 0,
  isRunning = false,
  onNameClick,
  onStatsClick,
  onClick,
  onManualEntry,
  onSettingsClick,
  nameClassName = "",
  readOnly = false,
  allowNameClickWhenReadOnly = false,
  className = "",
}: ActivityPillProps) {
  const textColor = getContrastColor(color);
  const timerLabel = formatTimerDisplay(elapsedMs);
  const nameInteractive = !readOnly || allowNameClickWhenReadOnly;
  const hasSettingsAction = !readOnly && !!onSettingsClick;
  // Stats click takes priority over onNameClick when provided
  const handleNameClick = onStatsClick ?? onNameClick;

  return (
    <div
      className={cn(
        "relative flex h-10 w-full items-stretch gap-2 overflow-hidden rounded-full",
        className
      )}
    >
      {/* Name / label side */}
      <div
        className={cn(
          "flex min-w-0 flex-1 items-stretch overflow-hidden rounded-full border border-input bg-background",
          readOnly && !allowNameClickWhenReadOnly
            ? "pointer-events-none shadow-sm"
            : readOnly
              ? "shadow-sm"
              : "shadow-none"
        )}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={nameInteractive ? handleNameClick : undefined}
          className={cn(
            "h-full min-h-0 min-w-0 flex-1 flex-col items-stretch justify-center gap-0 rounded-none p-0 text-left text-sm font-medium shadow-none"
          )}
        >
          <span
            className={cn(
              "flex min-h-0 min-w-0 flex-1 items-center gap-2 py-1 pl-4",
              hasSettingsAction ? "pr-0" : "pr-4"
            )}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className={cn("min-w-0 flex-1 truncate", nameClassName)}>
              {name || (
                <span className="font-normal text-muted-foreground">Name…</span>
              )}
            </span>
          </span>
        </Button>
        {hasSettingsAction && (
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onSettingsClick?.();
            }}
            title="Activity settings"
            aria-label="Activity settings"
            className="h-full w-10 shrink-0 justify-start rounded-none px-0 pl-2 pr-4 text-muted-foreground shadow-none hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

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
              isRunning ? "border-2" : "border-border text-muted-foreground"
            )}
            style={
              isRunning ? { borderColor: color, color: textColor } : undefined
            }
          >
            {isRunning ? (
              <Square
                className="h-3.5 w-3.5 shrink-0"
                style={{ fill: textColor }}
              />
            ) : (
              <Play className="h-3.5 w-3.5 shrink-0 translate-x-px fill-muted-foreground" />
            )}
            <span
              className={cn(
                "font-mono text-xs",
                !isRunning && "text-muted-foreground"
              )}
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
            style={
              isRunning
                ? { backgroundColor: color, color: textColor }
                : undefined
            }
          >
            {isRunning ? (
              <Square
                className="h-3.5 w-3.5 shrink-0"
                style={{ fill: textColor }}
              />
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
