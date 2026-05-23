import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { FormDialog } from "@/components/forms";
import { ShareCompletionsToggle } from "@/components/activities/share-completions-toggle";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  getActivityDisplayName,
  getMilestoneProgress,
  formatMilestoneStreakLine,
  showsMilestones,
} from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { cn } from "@/lib/utils";

interface ActivityStreakDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
  group: ActivityGroup | undefined;
  streak: number;
}

export function ActivityStreakDialog({
  open,
  onOpenChange,
  activity,
  group,
  streak,
}: ActivityStreakDialogProps) {
  const [activityState, setActivityState] = useState<Activity | null>(activity);

  useEffect(() => {
    if (open) setActivityState(activity);
  }, [open, activity]);

  const resolved = activityState ?? activity;
  if (!resolved) return null;

  const name = getActivityDisplayName(resolved, group);
  const color = group?.color || DEFAULT_GROUP_COLOR;
  const hasMilestones = showsMilestones(resolved.routine);
  const progress = hasMilestones
    ? getMilestoneProgress(streak)
    : null;
  const streakLine = progress
    ? formatMilestoneStreakLine(streak, resolved.routine, progress)
    : `${streak} day${streak === 1 ? "" : "s"}`;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setActivityState(activity);
        onOpenChange(next);
      }}
      title={name}
      description={
        hasMilestones
          ? "Streak and next milestone"
          : "Current streak for this habit"
      }
    >
      <div className="space-y-4">
        {hasMilestones && progress ? (
          <div className="overflow-hidden rounded-xl border border-border/80">
            <div className="h-1.5 w-full bg-muted" aria-hidden>
              <div
                className="h-full transition-[width] duration-300"
                style={{
                  width: `${progress.progressPercent}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-3.5 py-3">
              <span className="text-sm text-muted-foreground">
                Next milestone: {progress.next}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
                <Flame className="h-4 w-4 shrink-0" />
                {streakLine}
              </span>
            </div>
          </div>
        ) : (
          <p
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/20 py-6 text-lg font-semibold tabular-nums"
            )}
          >
            <Flame className="h-5 w-5" />
            {streakLine}
          </p>
        )}

        <ShareCompletionsToggle
          activity={resolved}
          onUpdated={setActivityState}
        />
      </div>
    </FormDialog>
  );
}
