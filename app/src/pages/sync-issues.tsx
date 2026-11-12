import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";

import { ConfirmFormDialog } from "@/components/forms";
import { AppRefreshActions } from "@/components/pwa/app-refresh-actions";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { ConflictReviewCard } from "@/components/settings/conflict-review-card";
import { RecoveryBundlesSection } from "@/components/settings/recovery-bundles-section";
import { SettingsGroup } from "@/components/settings/settings-list";
import { Button } from "@/components/ui/button";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { useAsyncData } from "@/hooks/use-async-data";
import type {
  SyncDeviceRecord,
  SyncIssue,
  SyncPendingOperation,
} from "@/lib/db/types";
import { syncEngine } from "@/lib/sync";
import { getOrCreateDeviceId } from "@/lib/sync/device-id";
import {
  discardPendingOperation,
  listUnsyncedOperations,
} from "@/lib/sync/pending-operations";
import { listSyncIssues, resolveSyncIssue } from "@/lib/sync/sync-issues-store";
import { db } from "@/lib/db";

interface SyncIssuesData {
  conflicts: SyncIssue[];
  pendingOps: SyncPendingOperation[];
  errors: SyncIssue[];
  resolved: SyncIssue[];
  info: SyncIssue[];
  devices: SyncDeviceRecord[];
  localDeviceId: string;
}

async function loadSyncIssuesData(): Promise<SyncIssuesData> {
  const localDeviceId = getOrCreateDeviceId();
  const [
    openConflicts,
    deferredConflicts,
    pendingOps,
    errors,
    resolved,
    info,
    devices,
  ] = await Promise.all([
    listSyncIssues({ kind: "conflict", status: "open" }),
    listSyncIssues({ kind: "conflict", status: "deferred" }),
    // Includes rejected (`failed`) operations: they hold data the server never
    // accepted, and they are what blocks this device from adopting a migration.
    listUnsyncedOperations(),
    listSyncIssues({ kind: "error", status: "open" }),
    listSyncIssues({ status: "resolved", limit: 20 }),
    listSyncIssues({ kind: "info", status: "open" }),
    db.syncDevices.toArray(),
  ]);

  const conflicts = [...openConflicts, ...deferredConflicts].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const sortedDevices = devices.sort(
    (a, b) =>
      new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
  );

  return {
    conflicts,
    pendingOps,
    errors,
    resolved,
    info,
    devices: sortedDevices,
    localDeviceId,
  };
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** Repeats of the same error collapse into one row with a count. */
interface IssueCluster {
  key: string;
  latest: SyncIssue;
  ids: string[];
}

function clusterIssues(issues: SyncIssue[], at: (i: SyncIssue) => string) {
  const clusters = new Map<string, IssueCluster>();
  for (const issue of issues) {
    const key = `${issue.title}\u0000${issue.detail ?? ""}`;
    const found = clusters.get(key);
    if (!found) {
      clusters.set(key, { key, latest: issue, ids: [issue.id] });
      continue;
    }
    found.ids.push(issue.id);
    if (new Date(at(issue)).getTime() > new Date(at(found.latest)).getTime()) {
      found.latest = issue;
    }
  }
  return [...clusters.values()];
}

const PILL = "h-8 gap-1 rounded-full px-3.5 text-xs";

/** One issue inside a group: title, detail, a quiet time, then its actions. */
function IssueRow({
  title,
  detail,
  when,
  count = 1,
  actions,
}: {
  title: string;
  detail?: string | null;
  when?: string;
  count?: number;
  actions?: ReactNode;
}) {
  const { t } = useTranslation("settings");
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-[0.9375rem] leading-snug text-foreground">
          {title}
        </p>
        {count > 1 ? (
          <span className="shrink-0 rounded-full bg-background/70 px-2 py-0.5 text-[0.6875rem] tabular-nums text-muted-foreground">
            {t("syncIssues.repeated", { count })}
          </span>
        ) : null}
      </div>
      {detail ? (
        <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
          {detail}
        </p>
      ) : null}
      {when ? (
        <p className="mt-1.5 text-[0.6875rem] tabular-nums text-muted-foreground/75">
          {when}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-3.5 text-sm text-muted-foreground">{children}</p>
  );
}

export default function SyncIssuesPage() {
  const { t } = useTranslation("settings");
  const { t: tNav } = useTranslation("nav");
  const [syncState, setSyncState] = useState(syncEngine.getState());
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [discardTarget, setDiscardTarget] =
    useState<SyncPendingOperation | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const { data, loading, error, reload } = useAsyncData(loadSyncIssuesData, []);

  useEffect(() => {
    return syncEngine.subscribe((state) => {
      setSyncState(state);
      reload();
    });
  }, [reload]);

  const handleRetrySync = useCallback(async () => {
    setIsSyncingManual(true);
    try {
      await syncEngine.sync();
    } finally {
      setIsSyncingManual(false);
      reload();
    }
  }, [reload]);

  const handleResolveIssues = useCallback(
    async (ids: string[]) => {
      for (const id of ids) await resolveSyncIssue(id);
      reload();
    },
    [reload]
  );

  const handleDiscardPending = useCallback(async () => {
    if (!discardTarget) return;
    setIsDiscarding(true);
    try {
      await discardPendingOperation(discardTarget.id);
      setDiscardTarget(null);
      reload();
    } finally {
      setIsDiscarding(false);
    }
  }, [discardTarget, reload]);

  const isSyncing = syncState.isSyncing || isSyncingManual;
  const conflicts = data?.conflicts ?? [];
  const pendingOps = data?.pendingOps ?? [];
  const errors = data?.errors ?? [];
  const resolved = data?.resolved ?? [];
  const info = data?.info ?? [];
  const devices = data?.devices ?? [];
  const errorClusters = clusterIssues(errors, (i) => i.updated_at);
  const infoClusters = clusterIssues(info, (i) => i.updated_at);
  const resolvedClusters = clusterIssues(
    resolved,
    (i) => i.resolved_at ?? i.updated_at
  );
  const localDeviceId = data?.localDeviceId ?? getOrCreateDeviceId();

  return (
    <AppPageShell
      title={t("syncIssues.page.title")}
      subtitle={t("syncIssues.page.subtitle")}
      className="space-y-9"
    >
      <SettingsGroup title={t("sync.title")}>
        <AppRefreshActions layout="rows" />
      </SettingsGroup>

      {loading && !data ? (
        <p className="px-4 text-sm text-muted-foreground">
          {t("syncIssues.loading")}
        </p>
      ) : null}

      {error ? <p className="px-4 text-sm text-destructive">{error}</p> : null}

      <RecoveryBundlesSection />

      <SettingsGroup
        title={t("syncIssues.sections.review.title")}
        footer={t("syncIssues.sections.review.description")}
      >
        {conflicts.length === 0 ? (
          <EmptyRow>{t("syncIssues.sections.review.empty")}</EmptyRow>
        ) : (
          conflicts.map((issue) => (
            <ConflictReviewCard
              key={issue.id}
              issue={issue}
              onResolved={reload}
            />
          ))
        )}
      </SettingsGroup>

      <SettingsGroup
        title={t("syncIssues.sections.pending.title")}
        footer={t("syncIssues.sections.pending.description")}
      >
        {pendingOps.length === 0 ? (
          <EmptyRow>{t("syncIssues.sections.pending.empty")}</EmptyRow>
        ) : (
          pendingOps.map((op) => (
            <IssueRow
              key={op.id}
              title={t("syncIssues.sections.pending.itemTitle", {
                type: op.operation_type,
                entity: op.entity_type,
              })}
              detail={
                op.last_error ??
                t("syncIssues.sections.pending.itemDetail", {
                  id: op.operation_id,
                })
              }
              when={formatWhen(op.created_at)}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${PILL} text-destructive`}
                  onClick={() => setDiscardTarget(op)}
                >
                  {t("syncIssues.actions.discard")}
                </Button>
              }
            />
          ))
        )}
      </SettingsGroup>

      <SettingsGroup
        title={t("syncIssues.sections.errors.title")}
        footer={t("syncIssues.sections.errors.description")}
      >
        {errorClusters.length === 0 ? (
          <EmptyRow>{t("syncIssues.sections.errors.empty")}</EmptyRow>
        ) : (
          errorClusters.map(({ key, latest, ids }) => (
            <IssueRow
              key={key}
              title={latest.title}
              detail={latest.detail}
              when={formatWhen(latest.updated_at)}
              count={ids.length}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className={PILL}
                    onClick={() => void handleRetrySync()}
                    disabled={isSyncing}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    {t("syncIssues.actions.retry")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={PILL}
                    onClick={() => void handleResolveIssues(ids)}
                  >
                    {t("syncIssues.actions.dismiss")}
                  </Button>
                </>
              }
            />
          ))
        )}
      </SettingsGroup>

      {infoClusters.length > 0 ? (
        <SettingsGroup
          title={t("syncIssues.sections.info.title")}
          footer={t("syncIssues.sections.info.description")}
        >
          {infoClusters.map(({ key, latest, ids }) => (
            <IssueRow
              key={key}
              title={latest.title}
              detail={latest.detail}
              when={formatWhen(latest.updated_at)}
              count={ids.length}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  className={PILL}
                  onClick={() => void handleResolveIssues(ids)}
                >
                  {t("syncIssues.actions.dismiss")}
                </Button>
              }
            />
          ))}
        </SettingsGroup>
      ) : null}

      <SettingsGroup
        title={t("syncIssues.sections.resolved.title")}
        footer={t("syncIssues.sections.resolved.description")}
      >
        {resolvedClusters.length === 0 ? (
          <EmptyRow>{t("syncIssues.sections.resolved.empty")}</EmptyRow>
        ) : (
          resolvedClusters.map(({ key, latest, ids }) => (
            <IssueRow
              key={key}
              title={latest.title}
              detail={latest.detail}
              when={formatWhen(latest.resolved_at ?? latest.updated_at)}
              count={ids.length}
            />
          ))
        )}
      </SettingsGroup>

      <SettingsGroup
        title={t("syncIssues.sections.device.title")}
        footer={t("syncIssues.sections.device.description")}
      >
        {devices.length === 0 ? (
          <EmptyRow>{t("syncIssues.sections.device.empty")}</EmptyRow>
        ) : (
          devices.map((device) => (
            <div key={device.id} className="px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[0.9375rem] leading-snug">
                  {device.label?.trim() ||
                    (device.id === localDeviceId
                      ? t("syncIssues.sections.device.thisDevice")
                      : t("syncIssues.sections.device.otherDevice"))}
                </p>
                {device.id === localDeviceId ? (
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-[0.6875rem] uppercase tracking-[0.1em] text-muted-foreground">
                    {t("syncIssues.sections.device.currentBadge")}
                  </span>
                ) : null}
              </div>
              <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">
                  {t("syncIssues.sections.device.lastSeenLabel")}
                </dt>
                <dd className="text-right tabular-nums">
                  {formatWhen(device.last_seen_at)}
                </dd>
                <dt className="text-muted-foreground">
                  {t("syncIssues.sections.device.idLabel")}
                </dt>
                <dd className="truncate text-right font-mono text-[0.6875rem] text-muted-foreground">
                  {device.id}
                </dd>
              </dl>
            </div>
          ))
        )}
      </SettingsGroup>

      <ConfirmFormDialog
        open={discardTarget != null}
        onOpenChange={(open) => {
          if (!open) setDiscardTarget(null);
        }}
        title={t("syncIssues.discardDialog.title")}
        message={t("syncIssues.discardDialog.message")}
        confirmLabel={t("syncIssues.discardDialog.confirm")}
        cancelLabel={t("syncIssues.discardDialog.cancel")}
        destructive
        busy={isDiscarding}
        onConfirm={() => void handleDiscardPending()}
      />

      <FloatingBackButton to="/settings" title={tNav("settings")} />
    </AppPageShell>
  );
}
