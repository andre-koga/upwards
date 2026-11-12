import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Github, History, MessageSquare } from "lucide-react";

import {
  SettingsActionRow,
  SettingsGroup,
} from "@/components/settings/settings-list";
import FeedbackDialog from "@/components/tasks/feedback-dialog";
import { hasUnreadWhatsNewRelease } from "@/lib/whats-new-read";

export function AboutCard() {
  const { t } = useTranslation("settings");
  const { t: tNav } = useTranslation("nav");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // The What's new page marks itself seen, so reading it once is enough.
  const [hasUnread] = useState(hasUnreadWhatsNewRelease);
  const whatsNewLabel = hasUnread ? tNav("whatsNewUnread") : tNav("whatsNew");

  return (
    <SettingsGroup title={t("about.title")}>
      <SettingsActionRow
        to="/whats-new"
        icon={History}
        label={tNav("whatsNew")}
        ariaLabel={whatsNewLabel}
        trailing={
          hasUnread ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-terracotta"
              aria-hidden
            />
          ) : null
        }
      />
      <SettingsActionRow
        icon={MessageSquare}
        label={tNav("feedback")}
        onClick={() => setFeedbackOpen(true)}
      />
      <SettingsActionRow
        to="/logs"
        icon={FileText}
        label={t("about.errorLogs")}
      />
      <SettingsActionRow
        href="https://github.com/andre-koga/upwards"
        icon={Github}
        label={t("about.github")}
      />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </SettingsGroup>
  );
}
