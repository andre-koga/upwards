import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { logError } from "@/lib/error-utils";
import { syncEngine } from "@/lib/sync";
import {
  exportClipsForYear,
  exportDataOnly,
  exportDataWithPhotos,
  listClipYears,
  type BackupProgress,
  type ClipYear,
  type ExportResult,
} from "./export";
import {
  BackupFileError,
  BackupImportBlockedError,
  getImportReadiness,
  importBackupFile,
  type BackupImportResult,
  type ImportBlockReason,
  type ImportProgress,
  type ImportReadiness,
} from "./import";

export type BackupTask = "data" | "photos" | "clips" | "import";

export interface BackupMessage {
  tone: "success" | "error";
  lines: string[];
  showSyncIssuesLink?: boolean;
}

type Progress =
  | ({ kind: "export" } & BackupProgress)
  | ({ kind: "import" } & ImportProgress);

export function useDataBackup() {
  const { t } = useTranslation("settings");
  const isOnline = useOnlineStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<BackupTask | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState<BackupMessage | null>(null);
  const [clipYears, setClipYears] = useState<ClipYear[] | null>(null);
  const [readiness, setReadiness] = useState<ImportReadiness | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void getImportReadiness({ sync: false }).then((next) => {
        if (!cancelled) setReadiness(next);
      });
    };
    refresh();
    const unsubscribe = syncEngine.subscribe(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isOnline]);

  const blockedText = useCallback(
    (reason: ImportBlockReason, pendingCount: number) =>
      t(`backup.import.blocked.${reason}`, { count: pendingCount }),
    [t]
  );

  /** Offline and outdated builds cannot sync at all, so import stays disabled. */
  const importDisabledReason =
    readiness?.reason === "offline" || readiness?.reason === "update_required"
      ? blockedText(readiness.reason, 0)
      : null;

  const exportMessage = (result: ExportResult): BackupMessage => ({
    tone: "success",
    lines: [
      t("backup.export.done"),
      ...(result.missingMedia > 0
        ? [t("backup.export.missingMedia", { count: result.missingMedia })]
        : []),
    ],
  });

  const runExport = async (
    task: Exclude<BackupTask, "import">,
    run: (onProgress: (p: BackupProgress) => void) => Promise<ExportResult>
  ) => {
    setBusy(task);
    setMessage(null);
    try {
      const result = await run((p) => setProgress({ kind: "export", ...p }));
      setMessage(exportMessage(result));
    } catch (err) {
      logError("Backup export failed", err);
      setMessage({ tone: "error", lines: [t("backup.export.failed")] });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const exportData = () => runExport("data", exportDataOnly);
  const exportPhotos = () => runExport("photos", exportDataWithPhotos);
  const exportClips = (year: number) =>
    runExport("clips", (onProgress) => exportClipsForYear(year, onProgress));

  const toggleClipYears = async () => {
    if (clipYears) {
      setClipYears(null);
      return;
    }
    try {
      setClipYears(await listClipYears());
    } catch (err) {
      logError("Listing clip years failed", err);
      setMessage({ tone: "error", lines: [t("backup.export.failed")] });
    }
  };

  const importMessage = (result: BackupImportResult): BackupMessage => {
    const lines: string[] = [];
    if (result.kind === "data") {
      const s = result.summary;
      lines.push(
        t("backup.import.done"),
        t("backup.import.summary", {
          inserted: s.inserted,
          updated: s.updated,
          unchanged: s.unchanged,
        })
      );
      if (s.countsAdded > 0) {
        lines.push(t("backup.import.countsAdded", { count: s.countsAdded }));
      }
      if (s.keptNewer > 0) {
        lines.push(t("backup.import.keptNewer", { count: s.keptNewer }));
      }
      if (s.journalConflicts > 0) {
        lines.push(t("backup.import.conflicts", { count: s.journalConflicts }));
      }
    } else {
      lines.push(
        t("backup.import.clipsDone", {
          count: result.media.restored + result.media.alreadyPresent,
        })
      );
      if (result.unmatched > 0) {
        lines.push(
          t("backup.import.clipsUnmatched", { count: result.unmatched })
        );
      }
    }
    if (result.media.restored > 0 && result.kind === "data") {
      lines.push(
        t("backup.import.mediaRestored", { count: result.media.restored })
      );
    }
    if (result.media.failed > 0) {
      lines.push(
        t("backup.import.mediaFailed", { count: result.media.failed })
      );
    }
    return {
      tone: "success",
      lines,
      showSyncIssuesLink:
        result.kind === "data" && result.summary.journalConflicts > 0,
    };
  };

  const errorMessage = (err: unknown): BackupMessage => {
    if (err instanceof BackupImportBlockedError) {
      const { reason, pendingCount } = err.readiness;
      return {
        tone: "error",
        lines: [blockedText(reason ?? "sync_failed", pendingCount)],
        showSyncIssuesLink:
          reason === "pending_changes" || reason === "sync_failed",
      };
    }
    if (err instanceof BackupFileError) {
      return {
        tone: "error",
        lines: [t(`backup.import.fileError.${err.code}`)],
      };
    }
    return { tone: "error", lines: [t("backup.import.failed")] };
  };

  const chooseImportFile = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("import");
    setMessage(null);
    try {
      const result = await importBackupFile(file, (p) =>
        setProgress({ kind: "import", ...p })
      );
      setMessage(importMessage(result));
    } catch (err) {
      if (!(err instanceof BackupImportBlockedError)) {
        logError("Backup import failed", err);
      }
      setMessage(errorMessage(err));
    } finally {
      setBusy(null);
      setProgress(null);
      setReadiness(await getImportReadiness({ sync: false }));
    }
  };

  const progressText = progress
    ? progress.phase === "media"
      ? t(`backup.progress.media.${progress.kind}`, {
          done: Math.min(progress.done + 1, progress.total),
          total: progress.total,
        })
      : t(`backup.progress.${progress.phase}`)
    : null;

  return {
    fileInputRef,
    busy,
    progressText,
    message,
    clipYears,
    importDisabledReason,
    exportData,
    exportPhotos,
    exportClips,
    toggleClipYears,
    chooseImportFile,
    handleImportFile,
  };
}
