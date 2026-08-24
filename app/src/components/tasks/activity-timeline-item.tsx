import { memo } from "react";
import { useTranslation } from "react-i18next";
import { formatTimerDisplay } from "@/lib/activity";
import { formatClockTime } from "@/lib/time-utils";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TIMELINE_ITEM_NAME_CLASS =
  "block whitespace-normal break-words text-sm";
export const TIMELINE_ITEM_NOTE_CLASS =
  "mt-0.5 block whitespace-pre-wrap break-words text-xs text-muted-foreground";

interface ActivityTimelineItemProps {
  activityName: string;
  groupColor: string;
  intervalMs: number;
  activityId: string;
  note?: string | null;
  untimed?: boolean;
  completedAtIso?: string | null;
  onStartActivity?: (activityId: string) => void;
  onClick?: () => void;
  className?: string;
}

function ActivityTimelineItem({
  activityName,
  groupColor,
  intervalMs,
  activityId,
  note,
  untimed = false,
  completedAtIso,
  onStartActivity,
  onClick,
  className = "",
}: ActivityTimelineItemProps) {
  const { t } = useTranslation("today");
  const hasPlayAction = !!onStartActivity && !untimed;
  const trimmedNote = note?.trim() || "";
  const clockTime =
    untimed && completedAtIso ? formatClockTime(completedAtIso) : "";
  const completedLabel = clockTime
    ? t("timelineItem.completedAt", { time: clockTime })
    : "";
  const activityContent = (
    <span className="flex min-w-0 items-start gap-2">
      <span
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: groupColor }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 text-left">
        <span className={TIMELINE_ITEM_NAME_CLASS}>{activityName}</span>
        {trimmedNote ? (
          <span className={TIMELINE_ITEM_NOTE_CLASS}>{trimmedNote}</span>
        ) : null}
      </span>
    </span>
  );
  const trailingDisplay = untimed ? (
    clockTime ? (
      <span
        className="shrink-0 px-2 py-0.5 text-xs text-muted-foreground"
        title={completedLabel}
        aria-label={completedLabel}
      >
        {clockTime}
      </span>
    ) : null
  ) : (
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
        className={`h-auto w-full items-start justify-between gap-3 whitespace-normal rounded-md px-1.5 py-1.5 font-normal hover:bg-muted ${className}`}
      >
        <span className="min-w-0 flex-1">{activityContent}</span>
        {trailingDisplay}
      </Button>
    ) : (
      <div
        className={`flex items-start justify-between gap-3 whitespace-normal px-1.5 py-1.5 ${className}`}
      >
        <div className="min-w-0 flex-1">{activityContent}</div>
        {trailingDisplay}
      </div>
    );
  }

  return (
    <div className={`flex items-start justify-between ${className}`}>
      {onClick ? (
        <Button
          type="button"
          variant="bare"
          onClick={onClick}
          className="h-auto min-w-0 flex-1 items-start justify-start whitespace-normal rounded-md py-1.5 pl-1.5 pr-3 text-left font-normal hover:bg-muted"
        >
          {activityContent}
        </Button>
      ) : (
        <div className="min-w-0 flex-1 py-1.5 pl-1.5 pr-3">
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
        className="mr-1.5 mt-1 h-auto shrink-0 gap-1.5 rounded-full border-border px-2 py-0.5 font-mono text-xs font-normal text-muted-foreground shadow-none"
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
