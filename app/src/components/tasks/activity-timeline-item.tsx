import { formatTimerDisplay } from "@/lib/activity-utils";
import { Play } from "lucide-react";

interface ActivityTimelineItemProps {
  activityName: string;
  groupColor: string;
  intervalMs: number;
  activityId: string;
  onStartActivity?: (activityId: string) => void;
  className?: string;
}

export default function ActivityTimelineItem({
  activityName,
  groupColor,
  intervalMs,
  activityId,
  onStartActivity,
  className = "",
}: ActivityTimelineItemProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-1.5 py-1.5 ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: groupColor }}
        />
        <span className="text-sm truncate">{activityName}</span>
      </div>
      {onStartActivity ? (
        <button
          onClick={() => onStartActivity(activityId)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 border border-border rounded-full px-2 py-0.5 transition-colors"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
          title="Start this activity"
        >
          <Play className="h-2.5 w-2.5" />
          {formatTimerDisplay(intervalMs)}
        </button>
      ) : (
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 border border-border rounded-full px-2 py-0.5"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          <Play className="h-2.5 w-2.5" />
          {formatTimerDisplay(intervalMs)}
        </span>
      )}
    </div>
  );
}
