import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Loader2,
  Send,
  Share2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDailyRecap, type DailyRecapData } from "@/lib/recap/get-daily-recap";
import { shareDailyRecap } from "@/lib/social/share-daily-recap";
import { getActivityDisplayName, formatTimerDisplay } from "@/lib/activity";
import { fromDateString, formatWeekdayShortDate } from "@/lib/time-utils";

interface DailyRecapDialogProps {
  open: boolean;
  recapDate: string | null;
  loginStreak: number;
  onDismiss: () => void;
}

export function DailyRecapDialog({
  open,
  recapDate,
  loginStreak,
  onDismiss,
}: DailyRecapDialogProps) {
  const [recap, setRecap] = useState<DailyRecapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !recapDate) {
      setRecap(null);
      setShareOpen(false);
      setCaption("");
      setShared(false);
      setShareError(null);
      return;
    }
    setLoading(true);
    getDailyRecap(recapDate, loginStreak)
      .then(setRecap)
      .catch(() => setRecap(null))
      .finally(() => setLoading(false));
  }, [open, recapDate, loginStreak]);

  const handleShare = async () => {
    if (!recap) return;
    setSharing(true);
    setShareError(null);
    try {
      await shareDailyRecap(recap, caption);
      setShared(true);
      setShareOpen(false);
    } catch {
      setShareError("Failed to share. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const dateLabel = recapDate
    ? formatWeekdayShortDate(fromDateString(recapDate))
    : "";

  const loginStreakLabel =
    loginStreak >= 2
      ? `${loginStreak}-day check-in streak`
      : loginStreak === 1
        ? "First check-in today"
        : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onDismiss();
        }}
      >
        <DialogContent className="space-y-5 p-4">
          {/* Centered header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-lg font-semibold leading-none tracking-tight">Yesterday</p>
            {dateLabel && (
              <p className="text-sm text-muted-foreground">{dateLabel}</p>
            )}
            {loginStreakLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <Flame className="h-3 w-3" />
                {loginStreakLabel}
              </span>
            )}
          </div>
        {loading || !recap ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : recap.isBreakDay ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            This was a break day — all habits were skipped.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Completion score */}
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {recap.completed.length} of {recap.completed.length + recap.missed.length} habits completed
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    recap.completionRate === 100
                      ? "text-green-600 dark:text-green-500"
                      : recap.completionRate >= 50
                        ? "text-primary"
                        : "text-muted-foreground"
                  )}
                >
                  {recap.completionRate}%
                </span>
              </div>
              {recap.totalTrackedMs > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatTimerDisplay(recap.totalTrackedMs)} tracked
                </p>
              )}
            </div>

            {/* Completed habits */}
            {recap.completed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Completed
                </p>
                <ul className="space-y-1.5">
                  {recap.completed.map((item) => (
                    <li
                      key={item.activity.id}
                      className="flex items-center gap-3 rounded-lg px-1 py-0.5"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {getActivityDisplayName(item.activity, item.group)}
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
            {recap.missed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Missed
                </p>
                <ul className="space-y-1.5">
                  {recap.missed.map((item) => (
                    <li
                      key={item.activity.id}
                      className="flex items-center gap-3 rounded-lg px-1 py-0.5"
                    >
                      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {getActivityDisplayName(item.activity, item.group)}
                      </span>
                      {item.activity.routine === "never" && (
                        <span className="shrink-0 text-xs font-medium text-destructive">
                          Slipped
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Share section */}
            <div className="border-t border-border pt-4">
              {shared ? (
                <p className="text-center text-sm text-green-600 dark:text-green-500">
                  Shared with friends!
                </p>
              ) : shareOpen ? (
                <div className="space-y-3">
                  <textarea
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={3}
                    placeholder="Add a message for your friends… (optional)"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={280}
                    disabled={sharing}
                  />
                  {shareError && (
                    <p className="text-xs text-destructive">{shareError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setShareOpen(false)}
                      disabled={sharing}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => void handleShare()}
                      disabled={sharing}
                    >
                      {sharing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      {sharing ? "Sharing…" : "Share"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 className="h-4 w-4" />
                  Share with friends
                </Button>
              )}
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}
