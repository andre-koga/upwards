import type { InboxNotification } from "@/lib/notifications/use-notifications";

export function ActivityCompletionDetails({ n }: { n: InboxNotification }) {
  if (n.kind !== "activity_complete") return null;
  if (n.streak == null) return null;

  const unit = n.routine === "never" ? "days without slip" : "day streak";

  return (
    <p className="text-xs text-muted-foreground tabular-nums pt-0.5">
      {n.streak} {unit}
    </p>
  );
}
