import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, Upload, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { syncEngine } from "@/lib/sync";
import { getSyncIssuesSummary } from "@/lib/sync/sync-issues-summary";
import { useAuth } from "@/lib/use-auth";

export function SyncCard() {
  const { t } = useTranslation("settings");
  const { isAuthed } = useAuth();
  const [isForcePushing, setIsForcePushing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(syncEngine.getState().isSyncing);
  const [openIssueCount, setOpenIssueCount] = useState(0);

  useEffect(() => {
    return syncEngine.subscribe((state) => setIsSyncing(state.isSyncing));
  }, []);

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

  const handleForcePush = async () => {
    if (!isAuthed) return;
    setIsForcePushing(true);
    try {
      await syncEngine.forcePushToCloud();
    } finally {
      setIsForcePushing(false);
    }
  };

  if (!isAuthed) return null;

  return (
    <SettingsSection
      title={t("sync.title")}
      description={t("sync.description")}
    >
      <div className="space-y-2">
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
        <Button
          variant="outline"
          className="flex w-full items-center gap-2"
          onClick={handleForcePush}
          disabled={isForcePushing || isSyncing}
        >
          {isForcePushing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isForcePushing ? t("sync.pushing") : t("sync.forcePush")}
        </Button>
      </div>
    </SettingsSection>
  );
}
