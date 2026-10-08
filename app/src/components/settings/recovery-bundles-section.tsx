import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive, Download, Loader2, Upload } from "lucide-react";
import { ConfirmFormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { useAsyncData } from "@/hooks/use-async-data";
import { BACKUP_JSON_NAME } from "@/lib/backup/format";
import { ZipBlobWriter } from "@/lib/backup/zip";
import { loadRecoveryBundles, type RecoveryBundle } from "@/lib/db/recovery";
import {
  importRecoveryBundle,
  onRecoveryBundlesChange,
  removeRecoveryBundle,
  type RecoveryImportOutcome,
} from "@/lib/db/recovery-import";
import { getCachedUserId } from "@/lib/supabase";

/**
 * Rows a reset kept aside (lib/db/recovery.ts). Shown until the user removes
 * them; remove only appears once the rows were imported or downloaded, so the
 * last copy is never one tap from gone.
 */
export function RecoveryBundlesSection() {
  const { t } = useTranslation("settings");
  const { data, reload } = useAsyncData(loadRecoveryBundles, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Record<string, RecoveryImportOutcome>>(
    {}
  );
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const [removeTarget, setRemoveTarget] = useState<RecoveryBundle | null>(null);

  useEffect(() => onRecoveryBundlesChange(reload), [reload]);

  const handleImport = useCallback(async (bundle: RecoveryBundle) => {
    setBusy(bundle.saved_at);
    try {
      const result = await importRecoveryBundle(bundle.saved_at);
      setOutcome((prev) => ({ ...prev, [bundle.saved_at]: result }));
    } finally {
      setBusy(null);
    }
  }, []);

  const handleDownload = useCallback(async (bundle: RecoveryBundle) => {
    const zip = new ZipBlobWriter();
    zip.addJson(BACKUP_JSON_NAME, bundle.document);
    const url = URL.createObjectURL(await zip.finish());
    const a = document.createElement("a");
    a.href = url;
    a.download = `upwards-recovery-${bundle.saved_at.slice(0, 10)}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setDownloaded((prev) => new Set(prev).add(bundle.saved_at));
  }, []);

  const bundles = data ?? [];
  if (bundles.length === 0) return null;
  const userId = getCachedUserId();

  return (
    <SettingsSection
      title={t("syncIssues.sections.recovery.title")}
      icon={Archive}
      description={t("syncIssues.sections.recovery.description")}
    >
      <div className="space-y-2">
        {bundles.map((bundle) => {
          const foreign =
            bundle.source_user_id !== null && bundle.source_user_id !== userId;
          const result = outcome[bundle.saved_at];
          const status = bundle.imported_at
            ? t("syncIssues.sections.recovery.imported", {
                when: new Date(bundle.imported_at).toLocaleString(),
              })
            : result === "blocked"
              ? t("syncIssues.sections.recovery.blocked")
              : result === "failed" || bundle.last_error
                ? t("syncIssues.sections.recovery.failed")
                : bundle.reason === "unowned_data" || foreign
                  ? t("syncIssues.sections.recovery.needsChoice")
                  : t("syncIssues.sections.recovery.waiting");
          const canRemove =
            !!bundle.imported_at || downloaded.has(bundle.saved_at);
          return (
            <div
              key={bundle.saved_at}
              className="rounded-lg border border-border bg-background p-3"
            >
              <p className="text-sm font-medium">
                {t(`syncIssues.sections.recovery.reason.${bundle.reason}`, {
                  when: new Date(bundle.saved_at).toLocaleString(),
                })}
              </p>
              <p
                className="mt-1 text-sm text-muted-foreground"
                role={result === "failed" ? "alert" : undefined}
              >
                {status}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!bundle.imported_at ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={busy !== null}
                    onClick={() => void handleImport(bundle)}
                  >
                    {busy === bundle.saved_at ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {t("syncIssues.sections.recovery.import")}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => void handleDownload(bundle)}
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("syncIssues.sections.recovery.download")}
                </Button>
                {canRemove ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setRemoveTarget(bundle)}
                  >
                    {t("syncIssues.sections.recovery.remove")}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <ConfirmFormDialog
        open={removeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={t("syncIssues.sections.recovery.removeDialog.title")}
        message={t("syncIssues.sections.recovery.removeDialog.message")}
        confirmLabel={t("syncIssues.sections.recovery.remove")}
        cancelLabel={t("syncIssues.discardDialog.cancel")}
        destructive
        onConfirm={() => {
          if (!removeTarget) return;
          void removeRecoveryBundle(removeTarget.saved_at).then(() =>
            setRemoveTarget(null)
          );
        }}
      />
    </SettingsSection>
  );
}
