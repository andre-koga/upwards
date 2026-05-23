import type { InboxNotification } from "@/lib/notifications/use-notifications";
import { cn } from "@/lib/utils";

export function ActivityCompletionDetails({ n }: { n: InboxNotification }) {
  if (n.kind !== "activity_complete") return null;
  if (n.streak == null || n.milestoneNext == null) return null;

  const unit =
    n.routine === "never" ? "days without slip" : "day streak";
  const width = n.progressPercent ?? 0;

  return (
    <div className="space-y-1.5 pt-0.5">
      <p className="text-xs text-muted-foreground tabular-nums">
        {n.streak} / {n.milestoneNext} {unit}
      </p>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full bg-primary transition-[width]")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
