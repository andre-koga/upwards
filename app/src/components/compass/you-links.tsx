import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import FeedbackDialog from "@/components/tasks/feedback-dialog";
import { Button } from "@/components/ui/button";
import { hasUnreadWhatsNewRelease } from "@/lib/whats-new-read";
import { CompassHeading } from "./compass-heading";

/**
 * Settings used to be this tab. These links keep it, What's new, feedback
 * and the error logs reachable once the tab is the compass.
 */
export function YouLinks() {
  const { t } = useTranslation("you");
  const { t: tNav } = useTranslation("nav");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [unread] = useState(hasUnreadWhatsNewRelease);
  const whatsNewLabel = unread ? tNav("whatsNewUnread") : tNav("whatsNew");

  return (
    <section aria-labelledby="compass-links">
      <CompassHeading id="compass-links" title={t("links.label")} />
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        <li>
          <Button
            asChild
            variant="ghost"
            className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal rounded-none px-4 py-2.5 font-normal"
          >
            <Link to="/settings">
              <span className="flex-1 text-left">{tNav("settings")}</span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                {t("links.settingsHint")}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </Button>
        </li>
        <li>
          <Button
            asChild
            variant="ghost"
            className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal rounded-none px-4 py-2.5 font-normal"
          >
            <Link to="/whats-new" aria-label={whatsNewLabel}>
              <span className="flex-1 text-left">{tNav("whatsNew")}</span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                {t("links.whatsNewHint")}
              </span>
              {unread ? (
                <span
                  className="size-2 shrink-0 rounded-full bg-terracotta"
                  aria-hidden
                />
              ) : null}
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </Button>
        </li>
        <li>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal rounded-none px-4 py-2.5 font-normal"
            onClick={() => setFeedbackOpen(true)}
          >
            <span className="flex-1 text-left">{tNav("feedback")}</span>
            <span className="hidden truncate text-xs font-normal text-muted-foreground sm:inline">
              {t("links.feedbackHint")}
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Button>
        </li>
        <li>
          <Button
            asChild
            variant="ghost"
            className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal rounded-none px-4 py-2.5 font-normal"
          >
            <Link to="/logs">
              <span className="flex-1 text-left">{tNav("errorLogs")}</span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                {t("links.logsHint")}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </Button>
        </li>
      </ul>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </section>
  );
}
