import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";

import { AppRefreshActions } from "@/components/pwa/app-refresh-actions";
import {
  SettingsActionRow,
  SettingsGroup,
  SettingsValueRow,
} from "@/components/settings/settings-list";
import { syncEngine } from "@/lib/sync";
import { getSyncIssuesSummary } from "@/lib/sync/sync-issues-summary";
import { getLocalSyncSafetyStatus } from "@/lib/sync/unsynced-data";
import { formatSyncTime } from "@/lib/time-utils";
import { useAuth } from "@/lib/use-auth";

export function SyncCard() {
  const { t } = useTranslation("settings");
  const { isAuthed } = useAuth();
  const [openIssueCount, setOpenIssueCount] = useState(0);
  const [syncState, setSyncState] = useState(syncEngine.getState());
  const [unsent, setUnsent] = useState({ ops: 0, rows: 0 });
  const [syncingSince, setSyncingSince] = useState<number | null>(() =>
    syncEngine.getState().isSyncing ? Date.now() : null
  );
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
      setSyncingSince((since) =>
        next.isSyncing ? (since ?? Date.now()) : null
      );
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

  const syncingSeconds =
    syncingSince !== null
      ? Math.max(0, Math.round((nowMs - syncingSince) / 1000))
      : null;

  return (
    <SettingsGroup
      title={t("sync.title")}
      footer={
        isAuthed && syncState.lastError ? (
          <p className="break-words text-destructive">
            {t("sync.details.lastError")}: {syncState.lastError}
          </p>
        ) : (
          t("sync.description")
        )
      }
    >
      <AppRefreshActions layout="rows" />
      {isAuthed ? (
        <>
          <SettingsActionRow
            to="/settings/sync-issues"
            icon={AlertCircle}
            label={t("sync.issuesLink")}
            trailing={
              openIssueCount > 0 ? (
                <span
                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-semibold tabular-nums text-destructive-foreground"
                  aria-label={t("sync.issuesBadge", { count: openIssueCount })}
                >
                  {openIssueCount}
                </span>
              ) : null
            }
          />
          <SettingsValueRow
            label={t("sync.details.lastSync")}
            value={
              syncState.lastSyncAt
                ? formatSyncTime(syncState.lastSyncAt)
                : t("sync.details.never")
            }
          />
          <SettingsValueRow
            label={t("sync.details.unsent")}
            value={t("sync.details.unsentValue", {
              ops: unsent.ops,
              rows: unsent.rows,
            })}
          />
          {syncingSeconds !== null ? (
            <SettingsValueRow
              label={t("sync.details.syncing")}
              value={t("sync.details.seconds", { count: syncingSeconds })}
            />
          ) : null}
        </>
      ) : null}
    </SettingsGroup>
  );
}
