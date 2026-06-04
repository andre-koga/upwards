import { CheckCircle2, Flame, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { InboxNotification } from "@/lib/notifications/use-notifications";
import { formatWeekdayShortDate } from "@/lib/time-utils";
import { formatTimerDisplay } from "@/lib/activity";

function formatSummaryDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return formatWeekdayShortDate(new Date(y, (m || 1) - 1, d || 1));
  } catch {
    return dateStr;
  }
}

function actorName(n: InboxNotification): string {
  return n.actorDisplayName?.trim() || n.actorUsername?.trim() || "Someone";
}

interface FriendRecapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  n: InboxNotification;
}

export function FriendRecapDialog({ open, onOpenChange, n }: FriendRecapDialogProps) {
  if (n.kind !== "daily_summary") return null;

  const completions = n.summaryCompletions ?? [];
  const completed = completions.filter((c) => c.completed !== false);
  const missed = completions.filter((c) => c.completed === false);
  const completedCount = n.summaryCompletedCount ?? 0;
  const totalCount = n.summaryTotalCount ?? 0;
  const totalTrackedMs = n.summaryTotalTrackedMs ?? 0;
  const completionRate = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const dateLabel = formatSummaryDate(n.summaryDate);
  const name = actorName(n);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="space-y-5 p-4" aria-describedby={undefined}>
        {/* Header */}
        <div className="flex flex-col items-center gap-1 text-center">
          <DialogTitle className="text-lg font-semibold leading-none tracking-tight">
            {name}&rsquo;s Day
          </DialogTitle>
          {dateLabel && (
            <DialogDescription>{dateLabel}</DialogDescription>
          )}
        </div>

        {/* Caption */}
        {n.summaryCaption && (
          <p className="text-center text-sm italic text-muted-foreground">
            &ldquo;{n.summaryCaption}&rdquo;
          </p>
        )}

        {/* Score */}
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {completedCount} of {totalCount} habits completed
            </span>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                completionRate === 100
                  ? "text-green-600 dark:text-green-500"
                  : completionRate >= 50
                    ? "text-primary"
                    : "text-muted-foreground"
              )}
            >
              {completionRate}%
            </span>
          </div>
          {totalTrackedMs > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatTimerDisplay(totalTrackedMs)} tracked
            </p>
          )}
        </div>

        {/* Completed habits */}
        {completed.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Completed
            </p>
            <ul className="space-y-1.5">
              {completed.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg px-1 py-0.5"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.activityName}
                  </span>
                  <span className="flex items-center gap-0.5 text-xs tabular-nums text-muted-foreground shrink-0">
                    <Flame className="h-3 w-3 text-orange-400" />
                    {item.streak}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missed habits */}
        {missed.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Missed
            </p>
            <ul className="space-y-1.5">
              {missed.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg px-1 py-0.5"
                >
                  <XCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {item.activityName}
                  </span>
                  {item.routine === "never" && (
                    <span className="text-xs font-medium text-destructive shrink-0">
                      Slipped
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
