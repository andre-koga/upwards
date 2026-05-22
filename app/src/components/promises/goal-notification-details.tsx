import type { InboxNotification } from "@/lib/promises/use-notifications";
import { cn } from "@/lib/utils";

function showsGoalSnapshot(n: InboxNotification): boolean {
  return (
    n.kind === "goal_share" ||
    n.kind === "goal_complete" ||
    n.kind === "goal_achieved"
  );
}

export function GoalNotificationDetails({ n }: { n: InboxNotification }) {
  if (!showsGoalSnapshot(n)) return null;
  if (!n.goalTitle && !n.goalLabel && n.streak == null && n.progressPercent == null) {
    return null;
  }

  const progressWidth =
    n.targetReached || n.periodEnded ? 100 : (n.progressPercent ?? 0);
  const showBar = n.progressPercent != null;

  return (
    <div
      className={cn(
        "mt-2 space-y-1.5 rounded-lg border px-3 py-2",
        n.kind === "goal_achieved"
          ? "border-green-500/25 bg-green-50/50 dark:bg-green-950/25"
          : "border-border/60 bg-muted/25"
      )}
    >
      {n.goalTitle ? (
        <p className="text-xs font-medium leading-snug">{n.goalTitle}</p>
      ) : null}
      {n.goalDescription && n.kind === "goal_share" ? (
        <p className="line-clamp-2 text-[11px] text-muted-foreground">
          {n.goalDescription}
        </p>
      ) : null}
      {n.goalLabel ? (
        <p className="text-[11px] text-muted-foreground">{n.goalLabel}</p>
      ) : null}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">
          {n.statusLabel ?? "In progress"}
        </span>
        {n.streak != null ? (
          <span className="font-medium tabular-nums">{n.streak}d streak</span>
        ) : null}
      </div>
      {showBar ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              n.targetReached || n.periodEnded
                ? "bg-green-500 dark:bg-green-400"
                : "bg-primary"
            )}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
