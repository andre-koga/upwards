import { Play, Plus, Square } from "lucide-react";
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
  onClick?: () => void;
  onManualEntry?: () => void;
  nameTitle?: string;
  nameAriaLabel?: string;
  nameClassName?: string;
  /** When true, renders timer/play as non-interactive display instead of buttons. */
  readOnly?: boolean;
  /** When readOnly, still allow tapping the name (e.g. retired info on past days). */
  allowNameClickWhenReadOnly?: boolean;
  /** False for check-only activities: there is no timer, so none is drawn. */
  showTimer?: boolean;
  /**
   * `pill` is a self-contained rounded control. `row` drops the box and the
   * full rounding so the pill can sit in a divided list (Today).
   */
  appearance?: "pill" | "row";
  className?: string;
}

export default function ActivityPill({
  name,
  color = DEFAULT_GROUP_COLOR,
  elapsedMs = 0,
  isRunning = false,
  onNameClick,
  onClick,
  onManualEntry,
  nameTitle,
  nameAriaLabel,
  nameClassName = "",
  readOnly = false,
  allowNameClickWhenReadOnly = false,
  showTimer = true,
  appearance = "pill",
  className = "",
}: ActivityPillProps) {
  const textColor = getContrastColor(color);
  const timerLabel = formatTimerDisplay(elapsedMs);
  const nameInteractive = !readOnly || allowNameClickWhenReadOnly;
  const row = appearance === "row";
  const hasManualEntry = !readOnly && Boolean(onManualEntry);

  return (
    <div
      className={cn(
        "relative flex h-10 w-full items-stretch gap-2",
        !row && "overflow-hidden rounded-full",
        className
      )}
    >
      {/* Name / label side */}
      <div
        className={cn(
          "flex min-w-0 flex-1 items-stretch overflow-hidden",
          row ? "rounded-md" : "rounded-full border border-border bg-muted/60",
          readOnly && !allowNameClickWhenReadOnly
            ? cn("pointer-events-none", !row && "shadow-sm")
            : readOnly
              ? !row && "shadow-sm"
              : "shadow-none"
        )}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={nameInteractive ? onNameClick : undefined}
          title={nameTitle}
          aria-label={nameAriaLabel}
          className={cn(
            "h-full min-h-0 min-w-0 flex-1 flex-col items-stretch justify-center gap-0 p-0 text-left text-sm font-medium shadow-none",
            row ? "rounded-md" : "rounded-none"
          )}
        >
          <span
            className={cn(
              "flex min-h-0 min-w-0 flex-1 items-center gap-2 py-1",
              row ? "pl-2 pr-2" : "pl-4 pr-4"
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
      </div>

      {/* Timer / action side */}
      {showTimer ? (
        <div className="flex h-full min-h-0 items-stretch">
          {hasManualEntry ? (
            <Button
              type="button"
              variant="outline"
              onClick={onManualEntry}
              className={cn(
                "relative h-full shrink-0 shadow-none",
                row
                  ? "w-9 rounded-l-md rounded-r-none border-r-0 text-muted-foreground"
                  : "-mr-4 w-12 rounded-l-full border-r-0 pr-6"
              )}
              title="Add manual time entry"
              aria-label="Add manual time entry"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          ) : null}

          {readOnly ? (
            <div
              className={cn(
                "relative flex h-full shrink-0 items-center justify-center gap-1.5 border bg-background text-xs font-semibold",
                row ? "rounded-md px-3" : "rounded-full px-4",
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
              className={cn(
                "relative h-full shrink-0 gap-1.5 font-semibold shadow-none",
                row
                  ? cn(
                      "rounded-md border border-border px-3",
                      hasManualEntry && "rounded-l-none"
                    )
                  : "rounded-full px-4"
              )}
              style={
                isRunning
                  ? {
                      backgroundColor: color,
                      borderColor: color,
                      color: textColor,
                    }
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
      ) : null}
    </div>
  );
}
