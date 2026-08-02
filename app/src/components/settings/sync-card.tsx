import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { syncEngine } from "@/lib/sync";
import { getSyncIssuesSummary } from "@/lib/sync/sync-issues-summary";
import { useAuth } from "@/lib/use-auth";

export function SyncCard() {
  const { t } = useTranslation("settings");
  const { isAuthed } = useAuth();
  const [openIssueCount, setOpenIssueCount] = useState(0);

  useEffect(() => {
    if (!isAuthed) return;

    let cancelled = false;

    const refresh = async () => {
      const summary = await getSyncIssuesSummary();
      if (!cancelled) setOpenIssueCount(summary.openTotal);
    };

    void refresh();
    const unsubscribe = syncEngine.subscribe(() => {
      void refresh();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAuthed]);

  if (!isAuthed) return null;

  return (
    <SettingsSection
      title={t("sync.title")}
      description={t("sync.description")}
    >
      <Button variant="outline" className="w-full" asChild>
        <Link to="/settings/sync-issues" className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="flex-1">{t("sync.issuesLink")}</span>
          {openIssueCount > 0 ? (
            <span
              className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white"
              aria-label={t("sync.issuesBadge", { count: openIssueCount })}
            >
              {openIssueCount}
            </span>
          ) : null}
        </Link>
      </Button>
    </SettingsSection>
  );
}
