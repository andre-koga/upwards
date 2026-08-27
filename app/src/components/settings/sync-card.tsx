import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, CloudDownload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { ConfirmFormDialog } from "@/components/forms";
import { syncEngine } from "@/lib/sync";
import { getSyncIssuesSummary } from "@/lib/sync/sync-issues-summary";
import { useAuth } from "@/lib/use-auth";

export function SyncCard() {
  const { t } = useTranslation("settings");
  const { isAuthed } = useAuth();
  const [openIssueCount, setOpenIssueCount] = useState(0);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

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

  const handleRestore = async () => {
    setRestoreBusy(true);
    setRestoreMessage(null);
    try {
      const result = await syncEngine.restoreFromCloudSnapshot();
      if (result.applied) {
        if (result.pendingAfterPush > 0) {
          setRestoreMessage(
            t("sync.restore.pendingWarning", {
              count: result.pendingAfterPush,
            })
          );
          setRestoreOpen(false);
          return;
        }
        // Pages read IndexedDB into React state on mount and nothing
        // subscribes to local data changes, so the new rows are invisible
        // until a remount. Reload once, on this explicit user action only.
        window.location.reload();
        return;
      }
      setRestoreMessage(
        result.error === "snapshot_unavailable"
          ? t("sync.restore.unavailable")
          : t("sync.restore.failed")
      );
    } finally {
      setRestoreBusy(false);
    }
  };

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

      <Button
        type="button"
        variant="outline"
        className="mt-2 w-full justify-start gap-2"
        onClick={() => {
          setRestoreMessage(null);
          setRestoreOpen(true);
        }}
      >
        <CloudDownload className="h-4 w-4" />
        {t("sync.restore.action")}
      </Button>

      {restoreMessage ? (
        <p className="text-muted-foreground mt-2 text-sm" role="status">
          {restoreMessage}
        </p>
      ) : null}

      <ConfirmFormDialog
        open={restoreOpen}
        onOpenChange={(next) => {
          if (!restoreBusy) setRestoreOpen(next);
        }}
        title={t("sync.restore.title")}
        message={t("sync.restore.description")}
        confirmLabel={
          restoreBusy ? t("sync.restore.working") : t("sync.restore.confirm")
        }
        cancelLabel={t("sync.restore.cancel")}
        busy={restoreBusy}
        onConfirm={() => {
          void handleRestore();
        }}
      />
    </SettingsSection>
  );
}
