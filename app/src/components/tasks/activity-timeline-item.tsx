import { memo } from "react";
import { formatTimerDisplay } from "@/lib/activity";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityTimelineItemProps {
  activityName: string;
  groupColor: string;
  intervalMs: number;
  activityId: string;
  onStartActivity?: (activityId: string) => void;
  onClick?: () => void;
  className?: string;
}

function ActivityTimelineItem({
  activityName,
  groupColor,
  intervalMs,
  activityId,
  onStartActivity,
  onClick,
  className = "",
}: ActivityTimelineItemProps) {
  const hasPlayAction = !!onStartActivity;

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
        <Button
          type="button"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            onStartActivity?.(activityId);
          }}
          className="h-auto shrink-0 gap-1.5 rounded-full border-border px-2 py-0.5 font-mono text-xs font-normal text-muted-foreground shadow-none"
          title="Start this activity"
        >
          <Play className="h-2.5 w-2.5" />
          {formatTimerDisplay(intervalMs)}
        </Button>
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
