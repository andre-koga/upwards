/**
 * SRP: Renders one activity row in a timeline with group color, interval display, and optional start or row click.
 */
import { memo } from "react";
import { formatTimerDisplay } from "@/lib/activity-utils";
import { Play } from "lucide-react";

interface ActivityTimelineItemProps {
  activityName: string;
  groupColor: string;
  intervalMs: number;
  activityId: string;
  onStartActivity?: (activityId: string) => void;
  onStartMemo?: () => void;
  onClick?: () => void;
  className?: string;
}

function ActivityTimelineItem({
  activityName,
  groupColor,
  intervalMs,
  activityId,
  onStartActivity,
  onStartMemo,
  onClick,
  className = "",
}: ActivityTimelineItemProps) {
  const hasPlayAction = !!(onStartActivity || onStartMemo);

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex items-center justify-between gap-3 px-1.5 py-1.5 ${onClick ? "cursor-pointer rounded-md transition-colors hover:bg-accent/50" : ""} ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: groupColor }}
        />
        <span className="truncate text-sm">{activityName}</span>
      </div>
      {hasPlayAction ? (
        <button
          onClick={(event) => {
            event.stopPropagation();
            if (onStartMemo) {
              onStartMemo();
            } else if (onStartActivity) {
              onStartActivity(activityId);
            }
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors"
          title={onStartMemo ? "Start this memo" : "Start this activity"}
        >
          <Play className="h-2.5 w-2.5" />
          {formatTimerDisplay(intervalMs)}
        </button>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
          <Play className="h-2.5 w-2.5" />
          {formatTimerDisplay(intervalMs)}
        </span>
      )}
    </div>
  );
}

export default memo(ActivityTimelineItem);
