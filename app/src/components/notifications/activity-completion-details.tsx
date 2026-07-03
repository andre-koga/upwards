import type { InboxNotification } from "@/lib/notifications/use-notifications";
import { useTranslation } from "react-i18next";

export function ActivityCompletionDetails({ n }: { n: InboxNotification }) {
  const { t } = useTranslation("notifications");

  if (n.kind !== "activity_complete") return null;
  if (n.streak == null) return null;

  const unit =
    n.routine === "never" ? t("daysWithoutSlip") : t("dayStreak");

  return (
    <p className="text-xs text-muted-foreground tabular-nums pt-0.5">
      {n.streak} {unit}
    </p>
  );
}
