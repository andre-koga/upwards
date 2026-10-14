import ActivityPill from "@/components/activities/activity-pill";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { activityTracksTime, getActivityDisplayName } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import type { DailyTaskInteractionState } from "@/lib/activity";

interface DailyTaskActivityPillProps {
  activity: Activity;
  group: ActivityGroup | undefined;
  timeSpent: number;
  isCurrentActivity: boolean;
  isPaused: boolean;
  interaction: DailyTaskInteractionState;
  isDayComplete: boolean;
  onNameClick: () => void;
  onStartActivity: (activityId: string) => void;
  onStopActivity: () => void;
  onManualEntry?: (activityId: string) => void;
  /** Quick pin from the row; not offered on read-only days. */
  onTogglePin?: (activity: Activity) => void;
}

export default function DailyTaskActivityPill({
  activity,
  group,
  timeSpent,
  isCurrentActivity,
  isPaused,
  interaction,
  isDayComplete,
  onNameClick,
  onStartActivity,
  onStopActivity,
  onManualEntry,
  onTogglePin,
}: DailyTaskActivityPillProps) {
  const groupColor = group?.color || DEFAULT_GROUP_COLOR;
  const canUseTimer = interaction.canUseTimer && !isPaused;

  return (
    <ActivityPill
      name={getActivityDisplayName(activity, group)}
      color={groupColor}
      elapsedMs={timeSpent}
      isRunning={isCurrentActivity}
      showTimer={activityTracksTime(activity)}
      pinned={activity.is_pinned === true}
      onTogglePin={
        onTogglePin && !interaction.isReadOnly
          ? () => onTogglePin(activity)
          : undefined
      }
      readOnly={interaction.isReadOnly}
      allowNameClickWhenReadOnly={
        interaction.isReadOnly && interaction.canClickName
      }
      onNameClick={interaction.canClickName ? onNameClick : undefined}
      onClick={
        canUseTimer
          ? () => {
              if (isCurrentActivity) {
                onStopActivity();
                return;
              }
              onStartActivity(activity.id);
            }
          : undefined
      }
      onManualEntry={
        canUseTimer && onManualEntry
          ? () => onManualEntry(activity.id)
          : undefined
      }
      appearance="row"
      nameClassName={isDayComplete ? "line-through text-muted-foreground" : ""}
    />
  );
}
