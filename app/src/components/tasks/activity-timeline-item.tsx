import { formatActivityTime } from "@/lib/activity-utils";

interface ActivityTimelineItemProps {
  activityName: string;
  groupColor: string;
  intervalMs: number;
  className?: string;
}

export default function ActivityTimelineItem({
  activityName,
  groupColor,
  intervalMs,
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
      <span
        className="text-xs text-muted-foreground shrink-0 border border-border rounded-full px-2 py-0.5"
        style={{ fontFamily: "JetBrains Mono, monospace" }}
      >
        {formatActivityTime(intervalMs)}
      </span>
    </div>
  );
}
