import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { syncEngine } from "@/lib/sync";
import { getSyncIssuesSummary } from "@/lib/sync/sync-issues-summary";
import { getLocalSyncSafetyStatus } from "@/lib/sync/unsynced-data";
import { formatSyncTime } from "@/lib/time-utils";
import { useAuth } from "@/lib/use-auth";
import { useLocalDatabaseHealth } from "@/hooks/use-local-database-health";

export function SyncCard() {
  const { t } = useTranslation("settings");
  const { isAuthed } = useAuth();
  const [openIssueCount, setOpenIssueCount] = useState(0);
  const [syncState, setSyncState] = useState(syncEngine.getState());
  const [unsent, setUnsent] = useState({ ops: 0, rows: 0 });
  const storageHealth = useLocalDatabaseHealth();
  const syncingSince = syncState.syncStartedAt;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isAuthed) return;

    let cancelled = false;

    const refresh = async () => {
      const [summary, safety] = await Promise.all([
        getSyncIssuesSummary(),
        getLocalSyncSafetyStatus(),
      ]);
      if (cancelled) return;
      setOpenIssueCount(summary.openTotal);
      setUnsent({ ops: safety.pendingOpCount, rows: safety.unsyncedRowCount });
    };

    void refresh();
    const unsubscribe = syncEngine.subscribe((next) => {
      setSyncState(next);
      void refresh();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAuthed]);

  useEffect(() => {
    if (syncingSince === null) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [syncingSince]);

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
              className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-semibold text-destructive-foreground"
              aria-label={t("sync.issuesBadge", { count: openIssueCount })}
            >
              {openIssueCount}
            </span>
          ) : null}
        </Link>
      </Button>
      <dl
        className="space-y-1 font-mono text-xs tabular-nums text-muted-foreground"
        aria-label={t("sync.details.label")}
      >
        <div className="flex justify-between gap-3">
          <dt>{t("sync.details.lastSync")}</dt>
          <dd>
            {syncState.lastSyncAt
              ? formatSyncTime(syncState.lastSyncAt)
              : t("sync.details.never")}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{t("sync.details.unsent")}</dt>
          <dd>
            {t("sync.details.unsentValue", {
              ops: unsent.ops,
              rows: unsent.rows,
            })}
          </dd>
        </div>
        {storageHealth !== "unknown" ? (
          <div className="flex justify-between gap-3">
            <dt>{t("sync.details.storage")}</dt>
            <dd
              className={
                storageHealth === "stalled" ? "text-destructive" : undefined
              }
            >
              {t(`sync.details.storageValue.${storageHealth}`)}
            </dd>
          </div>
        ) : null}
        {syncingSince !== null ? (
          <div className="flex justify-between gap-3">
            <dt>{t("sync.details.syncing")}</dt>
            <dd>
              {t("sync.details.seconds", {
                count: Math.max(0, Math.round((nowMs - syncingSince) / 1000)),
              })}
            </dd>
          </div>
        ) : null}
        {syncState.lastError ? (
          <div className="space-y-0.5">
            <dt>{t("sync.details.lastError")}</dt>
            <dd className="break-words text-foreground">
              {syncState.lastError}
            </dd>
          </div>
        ) : null}
      </dl>
    </SettingsSection>
  );
}
