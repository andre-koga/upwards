/**
 * Manage an owned Goal — progress, share, extend, complete, or cancel.
 */
import { useState, useEffect } from "react";
import { Target, CalendarCheck, Flame } from "lucide-react";

import { FormDialog, FormDialogActions } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useGoals } from "@/lib/promises/use-goals";
import {
  computeGoalProgress,
  getGoalActivityId,
} from "@/lib/promises/use-goal-progress";
import { GoalTargetForm } from "@/components/promises/goal-target-form";
import { GoalShareDialog } from "@/components/promises/goal-share-dialog";
import type { GoalTargetInput, GoalWithShares } from "@/lib/db/types";
import {
  formatGoalTargetShort,
  getGoalDescription,
  getGoalDisplayName,
} from "@/lib/promises/goal-display";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: GoalWithShares | undefined;
  activityStreaks: Record<string, number>;
  currentDate: Date;
  isToday: boolean;
  onChanged?: () => void;
}

type DialogView = "main" | "extend" | "confirm-cancel" | "share";

export function GoalDialog({
  open,
  onOpenChange,
  goal,
  activityStreaks,
  currentDate,
  isToday,
  onChanged,
}: GoalDialogProps) {
  const navigate = useNavigate();
  const { extendGoal, completeGoal, cancelGoal, loading, isSignedIn } = useGoals();
  const [ending, setEnding] = useState(false);
  const [view, setView] = useState<DialogView>("main");

  useEffect(() => {
    if (!open) setView("main");
  }, [open]);

  const goalTitle = goal ? getGoalDisplayName(goal) : "Goal";
  const goalDescription = goal ? getGoalDescription(goal) : null;

  const activityId = goal ? getGoalActivityId(goal) : null;
  const currentStreak = activityId ? (activityStreaks[activityId] ?? 0) : 0;
  const progress = goal
    ? computeGoalProgress(goal, currentStreak, currentDate)
    : {
        progressPercent: null as number | null,
        targetReached: false,
        periodEnded: false,
      };
  const { progressPercent, targetReached, periodEnded } = progress;
  const isDone = targetReached || periodEnded;
  const progressBarWidth = isDone ? 100 : (progressPercent ?? 0);

  const handleExtend = async (target: GoalTargetInput) => {
    if (!goal) return;
    await extendGoal(goal.id, target);
    setView("main");
    onChanged?.();
  };

  const handleEnd = async (status: "completed" | "cancelled") => {
    if (!goal) return;
    setEnding(true);
    try {
      if (status === "completed") {
        await completeGoal(goal.id);
      } else {
        await cancelGoal(goal.id);
      }
      onOpenChange(false);
      onChanged?.();
    } finally {
      setEnding(false);
    }
  };

  const titleMap: Record<DialogView, string> = {
    main: goalTitle,
    share: `Share — ${goalTitle}`,
    extend: `Extend — ${goalTitle}`,
    "confirm-cancel": "Cancel Goal?",
  };

  const descriptionMap: Record<DialogView, string | undefined> = {
    main: goalDescription ?? undefined,
    share: undefined,
    extend: "Raise the bar — pick a higher streak target.",
    "confirm-cancel": "This will end your current goal. Your streak is not affected.",
  };

  const showMainActions = view === "main" && goal && isSignedIn && !loading;

  return (
    <>
      <FormDialog
        open={open && goal !== undefined && view !== "share"}
        onOpenChange={onOpenChange}
        title={titleMap[view]}
        description={descriptionMap[view]}
      >
        {view === "confirm-cancel" && (
          <FormDialogActions
            onConfirm={() => void handleEnd("cancelled")}
            confirmLabel={ending ? "Cancelling…" : "Cancel Goal"}
            confirmDisabled={ending}
            confirmClassName="bg-destructive text-destructive-foreground shadow-md hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive"
            secondaryAction={{
              label: "Keep Goal",
              onClick: () => setView("main"),
              disabled: ending,
            }}
          />
        )}

        {view === "extend" && goal?.target_kind && (
          <GoalTargetForm
            lockedKind={goal.target_kind}
            initial={
              goal.target_kind === "streak_count" && goal.target_streak != null
                ? { kind: "streak_count", streak: goal.target_streak }
                : goal.target_kind === "streak_until" && goal.target_end_date != null
                  ? { kind: "streak_until", endDate: goal.target_end_date }
                  : undefined
            }
            minStreak={
              goal.target_kind === "streak_count" && goal.target_streak != null
                ? goal.target_streak + 1
                : undefined
            }
            minEndDate={
              goal.target_kind === "streak_until" && goal.target_end_date != null
                ? (() => {
                    const d = new Date(goal.target_end_date + "T00:00:00");
                    d.setDate(d.getDate() + 1);
                    return d.toISOString().slice(0, 10);
                  })()
                : undefined
            }
            submitLabel="Extend Goal"
            onSubmit={handleExtend}
            onCancel={() => setView("main")}
          />
        )}

        {view === "main" && (
          <>
            {!isSignedIn ? (
              <div className="space-y-3 py-2 text-sm text-muted-foreground">
                <p>Sign in to view Goals.</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/settings");
                  }}
                >
                  Go to Settings
                </Button>
              </div>
            ) : loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : !goal ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Goal not found.</p>
            ) : (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                  <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">{formatGoalTargetShort(goal)}</span>
                </div>

                {goal.activity_name?.trim() ? (
                  <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Linked habit
                    </p>
                    <p className="mt-1 text-sm font-medium leading-snug">
                      {goal.activity_name.trim()}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Current streak</span>
                    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                      <Flame className="h-3.5 w-3.5 text-foreground" />
                      {currentStreak}d
                    </span>
                  </div>
                  {progressPercent != null ? (
                    <>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-300",
                            isDone
                              ? "bg-green-500 dark:bg-green-400"
                              : "bg-primary"
                          )}
                          style={{ width: `${progressBarWidth}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isDone
                          ? targetReached
                            ? "Target reached"
                            : "Goal period ended"
                          : `${progressPercent}% toward target`}
                      </p>
                    </>
                  ) : null}
                </div>

                {isDone && isToday && (
                  <div className="rounded-xl border border-green-500/30 bg-green-50/60 px-4 py-3 dark:bg-green-950/30">
                    <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
                      <CalendarCheck className="h-4 w-4 shrink-0" />
                      {targetReached ? "Target reached!" : "Period ended!"}
                    </div>
                    <p className="mt-1 text-xs text-green-700/80 dark:text-green-400/70">
                      {targetReached
                        ? "You hit your streak goal. Mark it complete or extend the challenge."
                        : "The goal period is over. Mark it complete or push the target further."}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => void handleEnd("completed")}
                        disabled={ending}
                      >
                        Mark complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setView("extend")}
                        disabled={ending}
                      >
                        Extend
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {showMainActions && (
          <FormDialogActions
            secondaryAction={{
              label: "Share",
              onClick: () => setView("share"),
              disabled: ending,
            }}
            onConfirm={() => setView("confirm-cancel")}
            confirmLabel="Cancel Goal"
            confirmDisabled={ending || !isToday || isDone}
            confirmClassName="bg-destructive text-destructive-foreground shadow-md hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive"
          />
        )}
      </FormDialog>

      <GoalShareDialog
        open={open && view === "share"}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setView("main");
        }}
        goal={goal}
        onChanged={onChanged}
      />
    </>
  );
}
