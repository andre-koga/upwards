import type { InboxNotification } from "@/lib/notifications/notification-inbox-types";
import { useTranslation } from "react-i18next";

export function ActivityCompletionDetails({ n }: { n: InboxNotification }) {
  const { t } = useTranslation("notifications");

  if (n.kind !== "activity_complete") return null;
  if (n.streak == null) return null;

  const unit = n.routine === "never" ? t("daysWithoutSlip") : t("dayStreak");

  return (
    <p className="pt-0.5 text-xs tabular-nums text-muted-foreground">
      {n.streak} {unit}
    </p>
  );
}
