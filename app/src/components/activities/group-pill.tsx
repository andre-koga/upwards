/**
 * SRP: Renders a group as a pill with optional settings (cog), name, and start/stop action.
 */
import { Settings, Play, Square } from "lucide-react";
import { getContrastColor } from "@/lib/color-utils";

export interface GroupPillProps {
  name: string;
  color: string;
  isRunning?: boolean;
  onActionClick?: () => void;
  onNameClick?: () => void;
  /** When set, shows a cog button on the left that calls this (e.g. open group settings). */
  onSettingsClick?: () => void;
  /** When true, renders as a non-interactive div instead of a button */
  readOnly?: boolean;
  className?: string;
}

export default function GroupPill({
  name,
  color,
  isRunning,
  onActionClick,
  onNameClick,
  onSettingsClick,
  readOnly = false,
  className = "",
}: GroupPillProps) {
  const textColor = getContrastColor(color);
  const actionLabel = isRunning ? "Stop" : "Start";

  const base =
    "relative flex items-stretch gap-2 rounded-full overflow-hidden h-10 " +
    className;

  if (readOnly) {
    return (
      <div className={base}>
        {onSettingsClick && (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-muted-foreground" />
        )}
        <span className="flex-1 truncate px-4 text-left text-sm font-medium">
          {name || (
            <span className="font-normal text-muted-foreground/50">Name…</span>
          )}
        </span>
        <div
          className="relative mr-0.5 flex h-9 flex-shrink-0 items-center justify-center rounded-full px-4 text-xs font-semibold"
          style={{ backgroundColor: color, color: textColor }}
        >
          Start
        </div>
      </div>
    );
  }

  return (
    <div
      className={base}
      style={{
        background: `linear-gradient(to left, ${color}, transparent 30%)`,
      }}
    >
      {onSettingsClick && (
        <button
          type="button"
          onClick={onSettingsClick}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Group settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      )}
      <div className="flex w-full items-stretch rounded-full border border-border">
        <button
          type="button"
          onClick={onNameClick}
          className="h-full flex-1 truncate px-4 text-left text-sm font-medium"
        >
          {name || (
            <span className="font-normal text-muted-foreground/50">Name…</span>
          )}
        </button>
        <button
          type="button"
          onClick={onActionClick}
          className="relative flex h-full flex-shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold"
          style={{ backgroundColor: color, color: textColor }}
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
          <span className="mb-px w-8">{actionLabel}</span>
        </button>
      </div>
    </div>
  );
}
