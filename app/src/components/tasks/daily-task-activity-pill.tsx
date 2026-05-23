import { useEffect, useState } from "react";
import ActivityPill from "@/components/activities/activity-pill";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  getActivityDisplayName,
  getMilestoneProgress,
  showsMilestones,
} from "@/lib/activity";
import {
  ensureMilestoneCelebrationSeen,
  isMilestoneCelebrationPending,
  subscribeMilestoneCelebration,
} from "@/lib/activity/milestone-celebration";
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
  streak: number;
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
  streak,
  onNameClick,
  onStartActivity,
  onStopActivity,
  onManualEntry,
}: DailyTaskActivityPillProps) {
  const groupColor = group?.color || DEFAULT_GROUP_COLOR;
  const canUseTimer = interaction.canUseTimer && !isPaused;
  const [, bumpCelebration] = useState(0);

  useEffect(
    () => subscribeMilestoneCelebration(() => bumpCelebration((n) => n + 1)),
    []
  );

  const milestone = showsMilestones(activity.routine)
    ? getMilestoneProgress(streak)
    : null;

  useEffect(() => {
    if (milestone) ensureMilestoneCelebrationSeen(activity.id, milestone);
  }, [activity.id, milestone?.current, milestone?.prev, milestone?.next]);

  const milestoneCelebrating =
    milestone != null &&
    isMilestoneCelebrationPending(activity.id, milestone);

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
      milestoneProgressPercent={milestone?.progressPercent}
      milestoneAccentColor={groupColor}
      milestoneCelebrating={milestoneCelebrating}
    />
  );
}
