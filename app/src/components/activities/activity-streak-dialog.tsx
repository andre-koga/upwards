import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import { FormDialog } from "@/components/forms";
import { ShareCompletionsToggle } from "@/components/activities/share-completions-toggle";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  getActivityDisplayName,
  getMilestoneProgress,
  formatMilestoneLabel,
  showsMilestones,
  isAtMilestoneReached,
} from "@/lib/activity";
import {
  acknowledgeMilestoneCelebration,
  ensureMilestoneCelebrationSeen,
  formatMilestoneCongratulations,
  isMilestoneCelebrationPending,
} from "@/lib/activity/milestone-celebration";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const [displayStreak, setDisplayStreak] = useState(streak);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);

  useEffect(() => {
    if (open) {
      setActivityState(activity);
      setDisplayStreak(streak);
      setCelebrationDismissed(false);
    }
  }, [open, activity, streak]);

  const resolved = activityState ?? activity;
  const activityId = resolved?.id;
  const hasMilestones = resolved ? showsMilestones(resolved.routine) : false;
  const progress =
    resolved && hasMilestones ? getMilestoneProgress(displayStreak) : null;
  const unitLabel = formatMilestoneLabel(resolved?.routine ?? null);

  useEffect(() => {
    if (!open || !progress || !activityId) return;
    ensureMilestoneCelebrationSeen(activityId, progress);
    setCelebrationDismissed(
      !isMilestoneCelebrationPending(activityId, progress)
    );
  }, [open, activityId, progress?.current, progress?.prev, progress?.next]);

  if (!resolved) return null;

  const name = getActivityDisplayName(resolved, group);

  const showCelebration =
    progress != null &&
    isAtMilestoneReached(progress) &&
    !celebrationDismissed;

  const handleContinueMilestone = () => {
    if (!progress) return;
    acknowledgeMilestoneCelebration(resolved.id, progress.current);
    setCelebrationDismissed(true);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={name}
      contentClassName="space-y-8"
    >
      {hasMilestones && progress ? (
        <div className="space-y-6 px-1">
          {showCelebration ? (
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <PartyPopper
                  className="h-10 w-10 text-green-600 dark:text-green-500"
                  aria-hidden
                />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">Congratulations!</p>
                <p className="text-sm text-muted-foreground">
                  {formatMilestoneCongratulations(
                    progress.current,
                    resolved.routine
                  )}
                </p>
              </div>
              <p className="text-4xl font-semibold tabular-nums tracking-tight">
                {progress.current}
                <span className="ml-2 text-lg font-normal text-muted-foreground">
                  {unitLabel}
                </span>
              </p>
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-full bg-green-600 dark:bg-green-500" />
                </div>
                <div className="flex items-center justify-between text-sm tabular-nums text-muted-foreground">
                  <span>{progress.prev}</span>
                  <span>{progress.next}</span>
                </div>
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={handleContinueMilestone}
              >
                Continue to next milestone
              </Button>
            </div>
          ) : (
            <>
              <p className="text-center text-4xl font-semibold tabular-nums tracking-tight">
                {progress.current}
                <span className="ml-2 text-lg font-normal text-muted-foreground">
                  {unitLabel}
                </span>
              </p>

              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width] duration-300"
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm tabular-nums text-muted-foreground">
                  <span>{progress.prev}</span>
                  <span>{progress.next}</span>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <p
          className={cn(
            "py-4 text-center text-4xl font-semibold tabular-nums tracking-tight"
          )}
        >
          {displayStreak}
          <span className="ml-2 text-lg font-normal text-muted-foreground">
            {displayStreak === 1 ? "day" : "days"}
          </span>
        </p>
      )}

      <ShareCompletionsToggle
        activity={resolved}
        onUpdated={setActivityState}
      />
    </FormDialog>
  );
}
