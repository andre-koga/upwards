import { Play, Plus, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("today");
  const textColor = getContrastColor(color);
  const timerLabel = formatTimerDisplay(elapsedMs);
  const nameInteractive = !readOnly || allowNameClickWhenReadOnly;
  const row = appearance === "row";
  const hasManualEntry = !readOnly && Boolean(onManualEntry);
  // In a row, an untouched timer is just a play button: "00:00" on every habit
  // is noise. The time appears once there is some, or while it runs.
  const compactTimer = row && !isRunning && elapsedMs < 1000;
  const timerActionLabel = isRunning
    ? t("timer.stop", { name })
    : t("timer.start", { name });

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
            "h-full min-h-0 min-w-0 flex-1 flex-col items-stretch justify-center gap-0 p-0 text-left text-[0.9375rem] font-normal shadow-none",
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
              className="h-2 w-2 shrink-0 rounded-full"
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
              variant={row ? "ghost" : "outline"}
              onClick={onManualEntry}
              className={cn(
                "relative h-full shrink-0 shadow-none",
                row
                  ? "w-9 rounded-full text-muted-foreground/60"
                  : "-mr-4 w-12 rounded-l-full border-r-0 pr-6"
              )}
              title={t("timer.manualEntry")}
              aria-label={t("timer.manualEntry")}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          ) : null}

          {readOnly ? (
            <div
              className={cn(
                "relative flex h-full shrink-0 items-center justify-center gap-1.5 border bg-background text-xs font-semibold",
                row ? "rounded-full px-3" : "rounded-full px-4",
                isRunning ? "border-2" : "border-border text-muted-foreground",
                row && !isRunning && "border-transparent bg-muted/60"
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
                  "text-xs tabular-nums",
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
              title={timerActionLabel}
              aria-label={`${timerActionLabel}, ${timerLabel}`}
              className={cn(
                "relative h-full shrink-0 gap-1.5 font-semibold shadow-none",
                row
                  ? compactTimer
                    ? "w-10 rounded-full border-0 bg-transparent p-0 hover:bg-muted"
                    : "rounded-full border-0 bg-muted/50 px-3.5 text-muted-foreground hover:bg-muted"
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
                <Play
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 translate-x-px",
                    row
                      ? "fill-muted-foreground text-muted-foreground"
                      : "fill-secondary-foreground"
                  )}
                />
              )}
              {compactTimer ? null : (
                <span className="text-xs tabular-nums">{timerLabel}</span>
              )}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
