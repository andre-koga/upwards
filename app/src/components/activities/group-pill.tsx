import { Play, Square } from "lucide-react";
import { getContrastColor } from "@/lib/color-utils";

export interface GroupPillProps {
  name: string;
  color: string;
  isRunning?: boolean;
  onActionClick?: () => void;
  onNameClick?: () => void;
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
  readOnly = false,
  className = "",
}: GroupPillProps) {
  const textColor = getContrastColor(color);
  const actionLabel = isRunning ? "Stop" : "Start";

  const base =
    "relative flex items-center border border-border rounded-full overflow-hidden h-11 " +
    className;

  if (readOnly) {
    return (
      <div className={base}>
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
    <div className={base}>
      <button
        type="button"
        onClick={onNameClick}
        className="flex-1 truncate px-4 text-left text-sm font-medium"
      >
        {name || (
          <span className="font-normal text-muted-foreground/50">Name…</span>
        )}
      </button>
      <button
        type="button"
        onClick={onActionClick}
        className="relative mr-0.5 flex h-9 flex-shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold"
        style={{ backgroundColor: color, color: textColor }}
      >
        {isRunning ? (
          <Square className="h-3 w-3 flex-shrink-0" />
        ) : (
          <Play className="h-3 w-3 flex-shrink-0 translate-x-px" />
        )}
        {actionLabel}
      </button>
    </div>
  );
}
