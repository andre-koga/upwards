import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ExternalLink,
  FileText,
  Github,
  History,
  Info,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
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
    <SettingsSection title={t("about.title")} icon={Info}>
      <Button
        variant="outline"
        className="relative w-full justify-start"
        asChild
      >
        <Link to="/whats-new" aria-label={whatsNewLabel}>
          <History className="h-4 w-4" />
          {tNav("whatsNew")}
          {hasUnread ? (
            <span
              className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-terracotta"
              aria-hidden
            />
          ) : null}
        </Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        onClick={() => setFeedbackOpen(true)}
      >
        <MessageSquare className="h-4 w-4" />
        {tNav("feedback")}
      </Button>
      <Button variant="outline" className="w-full justify-start" asChild>
        <Link to="/logs">
          <FileText className="h-4 w-4" />
          {t("about.errorLogs")}
        </Link>
      </Button>
      <Button variant="outline" className="w-full justify-between" asChild>
        <a
          href="https://github.com/andre-koga/upwards"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            {t("about.github")}
          </span>
          <ExternalLink
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </a>
      </Button>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </SettingsSection>
  );
}
