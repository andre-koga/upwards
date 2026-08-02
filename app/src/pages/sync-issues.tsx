import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Smartphone,
  XCircle,
} from "lucide-react";

import { ConfirmFormDialog } from "@/components/forms";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { ConflictReviewCard } from "@/components/settings/conflict-review-card";
import { Button } from "@/components/ui/button";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { SettingsSection } from "@/components/ui/settings-section";
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
  listPendingOperations,
} from "@/lib/sync/pending-operations";
import { listSyncIssues, resolveSyncIssue } from "@/lib/sync/sync-issues-store";
import { db } from "@/lib/db";

interface SyncIssuesData {
  conflicts: SyncIssue[];
  pendingOps: SyncPendingOperation[];
  errors: SyncIssue[];
  resolved: SyncIssue[];
  localDevice: SyncDeviceRecord | null;
}

async function loadSyncIssuesData(): Promise<SyncIssuesData> {
  const deviceId = getOrCreateDeviceId();
  const [
    openConflicts,
    deferredConflicts,
    pendingOps,
    errors,
    resolved,
    localDevice,
  ] = await Promise.all([
    listSyncIssues({ kind: "conflict", status: "open" }),
    listSyncIssues({ kind: "conflict", status: "deferred" }),
    listPendingOperations({ status: "pending" }),
    listSyncIssues({ kind: "error", status: "open" }),
    listSyncIssues({ status: "resolved", limit: 20 }),
    db.syncDevices.get(deviceId).then((device) => device ?? null),
  ]);

  const conflicts = [...openConflicts, ...deferredConflicts].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return { conflicts, pendingOps, errors, resolved, localDevice };
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function IssueCard({
  title,
  detail,
  when,
  actions,
}: {
  title: string;
  detail?: string | null;
  when?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          {detail ? (
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          ) : null}
          {when ? (
            <p className="mt-2 text-xs text-muted-foreground">{when}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-col gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
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

  const handleResolveIssue = useCallback(
    async (id: string) => {
      await resolveSyncIssue(id);
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
  const localDevice = data?.localDevice;

  return (
    <AppPageShell
      title={t("syncIssues.page.title")}
      subtitle={t("syncIssues.page.subtitle")}
      className="space-y-3 md:max-w-5xl"
      breadcrumbs={[
        { label: tNav("today"), to: "/" },
        { label: t("page.title"), to: "/settings" },
        { label: t("syncIssues.page.title") },
      ]}
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void handleRetrySync()}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t("syncIssues.actions.retrySync")}
        </Button>
      </div>

      {loading && !data ? (
        <p className="text-sm text-muted-foreground">
          {t("syncIssues.loading")}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <SettingsSection
        title={t("syncIssues.sections.review.title")}
        icon={AlertTriangle}
        description={t("syncIssues.sections.review.description")}
      >
        {conflicts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("syncIssues.sections.review.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {conflicts.map((issue) => (
              <ConflictReviewCard
                key={issue.id}
                issue={issue}
                onResolved={reload}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title={t("syncIssues.sections.pending.title")}
        icon={Clock}
        description={t("syncIssues.sections.pending.description")}
      >
        {pendingOps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("syncIssues.sections.pending.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {pendingOps.map((op) => (
              <IssueCard
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
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDiscardTarget(op)}
                  >
                    {t("syncIssues.actions.discard")}
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title={t("syncIssues.sections.errors.title")}
        icon={XCircle}
        description={t("syncIssues.sections.errors.description")}
      >
        {errors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("syncIssues.sections.errors.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {errors.map((issue) => (
              <IssueCard
                key={issue.id}
                title={issue.title}
                detail={issue.detail}
                when={formatWhen(issue.updated_at)}
                actions={
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleResolveIssue(issue.id)}
                    >
                      {t("syncIssues.actions.dismiss")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => void handleRetrySync()}
                      disabled={isSyncing}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {t("syncIssues.actions.retry")}
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title={t("syncIssues.sections.resolved.title")}
        icon={CheckCircle2}
        description={t("syncIssues.sections.resolved.description")}
      >
        {resolved.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("syncIssues.sections.resolved.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {resolved.map((issue) => (
              <IssueCard
                key={issue.id}
                title={issue.title}
                detail={issue.detail}
                when={formatWhen(issue.resolved_at ?? issue.updated_at)}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title={t("syncIssues.sections.device.title")}
        icon={Smartphone}
        description={t("syncIssues.sections.device.description")}
      >
        {localDevice ? (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">
                {t("syncIssues.sections.device.idLabel")}
              </dt>
              <dd className="font-mono text-xs">{localDevice.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t("syncIssues.sections.device.lastSeenLabel")}
              </dt>
              <dd>{formatWhen(localDevice.last_seen_at)}</dd>
            </div>
            {localDevice.account_id ? (
              <div>
                <dt className="text-muted-foreground">
                  {t("syncIssues.sections.device.accountLabel")}
                </dt>
                <dd className="font-mono text-xs">{localDevice.account_id}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("syncIssues.sections.device.empty")}
          </p>
        )}
      </SettingsSection>

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
