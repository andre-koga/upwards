import ActivityPill from "@/components/activities/activity-pill";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  getActivityDisplayName,
} from "@/lib/activity";
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
}: DailyTaskActivityPillProps) {
  const groupColor = group?.color || DEFAULT_GROUP_COLOR;
  const canUseTimer = interaction.canUseTimer && !isPaused;

  return (
    <ActivityPill
      name={getActivityDisplayName(activity, group)}
      color={groupColor}
      elapsedMs={timeSpent}
      isRunning={isCurrentActivity}
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
      nameClassName={
        isDayComplete ? "line-through text-muted-foreground" : ""
      }
    />
  );
}
