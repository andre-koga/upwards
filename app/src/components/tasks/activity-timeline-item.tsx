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
  const activityContent = (
    <>
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: groupColor }}
        aria-hidden
      />
      <span className="truncate text-sm">{activityName}</span>
    </>
  );
  const timerDisplay = (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
      <Play className="h-2.5 w-2.5" aria-hidden />
      {formatTimerDisplay(intervalMs)}
    </span>
  );

  if (!hasPlayAction) {
    return onClick ? (
      <Button
        type="button"
        variant="bare"
        onClick={onClick}
        className={`h-auto w-full justify-between gap-3 rounded-md px-1.5 py-1.5 font-normal hover:bg-muted ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {activityContent}
        </span>
        {timerDisplay}
      </Button>
    ) : (
      <div
        className={`flex items-center justify-between gap-3 px-1.5 py-1.5 ${className}`}
      >
        <div className="flex min-w-0 items-center gap-2">{activityContent}</div>
        {timerDisplay}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {onClick ? (
        <Button
          type="button"
          variant="bare"
          onClick={onClick}
          className="h-auto min-w-0 flex-1 justify-start gap-2 rounded-md py-1.5 pl-1.5 pr-3 text-left font-normal hover:bg-muted"
        >
          {activityContent}
        </Button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-1.5 pr-3">
          {activityContent}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={(event) => {
          event.stopPropagation();
          onStartActivity?.(activityId);
        }}
        className="mr-1.5 h-auto shrink-0 gap-1.5 rounded-full border-border px-2 py-0.5 font-mono text-xs font-normal text-muted-foreground shadow-none"
        title="Start this activity"
        aria-label={`Start ${activityName}`}
      >
        <Play className="h-2.5 w-2.5" aria-hidden />
        {formatTimerDisplay(intervalMs)}
      </Button>
    </div>
  );
}

export default memo(ActivityTimelineItem);
