import { Play, Square } from "lucide-react";

function getContrastColor(hex: string): "#000000" | "#ffffff" {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#000000" : "#ffffff";
}

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
        <span className="flex-1 text-left font-medium truncate px-4 text-sm">
          {name || (
            <span className="text-muted-foreground/50 font-normal">Name…</span>
          )}
        </span>
        <div
          className="h-9 flex items-center justify-center flex-shrink-0 mr-0.5 relative rounded-full px-4 text-xs font-semibold"
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
        className="flex-1 text-left font-medium truncate px-4 text-sm"
      >
        {name || (
          <span className="text-muted-foreground/50 font-normal">Name…</span>
        )}
      </button>
      <button
        type="button"
        onClick={onActionClick}
        className="h-9 flex items-center justify-center flex-shrink-0 mr-0.5 relative rounded-full px-4 text-xs font-semibold gap-1.5"
        style={{ backgroundColor: color, color: textColor }}
      >
        {isRunning ? (
          <Square className="h-3 w-3 flex-shrink-0" />
        ) : (
          <Play className="h-3 w-3 translate-x-px flex-shrink-0" />
        )}
        {actionLabel}
      </button>
    </div>
  );
}
