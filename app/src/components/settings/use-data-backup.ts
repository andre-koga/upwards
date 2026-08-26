import { useRef, useState } from "react";
import { db } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  ActivityStatusEvent,
  DailyEntry,
  GroupStatusEvent,
  JournalEntry,
  OneTimeTask,
} from "@/lib/db/types";
import { normalizeSessionNote } from "@/lib/activity";
import { getErrorMessage, logError, ERROR_MESSAGES } from "@/lib/error-utils";
import { importBackup } from "@/lib/sync/mutate-synced";

type BackupStatus = "idle" | "success" | "error";

export function useDataBackup() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportStatus, setExportStatus] = useState<BackupStatus>("idle");
  const [importStatus, setImportStatus] = useState<BackupStatus>("idle");
  const [importMessage, setImportMessage] = useState("");

  const handleExport = async () => {
    try {
      const [
        activityGroups,
        activities,
        dailyEntries,
        activityPeriods,
        journalEntries,
        oneTimeTasks,
        activityStatusEvents,
        groupStatusEvents,
      ] = await Promise.all([
        db.activityGroups.toArray(),
        db.activities.toArray(),
        db.dailyEntries.toArray(),
        db.activityPeriods.toArray(),
        db.journalEntries.toArray(),
        db.oneTimeTasks.toArray(),
        db.activityStatusEvents.toArray(),
        db.groupStatusEvents.toArray(),
      ]);

      const backup = {
        exportedAt: new Date().toISOString(),
        version: 2,
        activityGroups,
        activities,
        dailyEntries,
        activityPeriods,
        journalEntries,
        oneTimeTasks,
        activityStatusEvents,
        groupStatusEvents,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `upwards-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("success");
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch (err) {
      console.error("Export failed:", err);
      setExportStatus("error");
      setTimeout(() => setExportStatus("idle"), 3000);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version || !data.activityGroups) {
        throw new Error("Invalid backup file format");
      }

      const normalizedActivities: Activity[] | undefined = data.activities
        ?.length
        ? data.activities.map((a: Record<string, unknown>) => {
            const copy = { ...a };
            const completedAt =
              typeof copy.completed_at === "string" ? copy.completed_at : null;
            const archived = copy.is_archived === true || Boolean(completedAt);
            copy.is_archived = archived;
            copy.completed_at = archived
              ? (completedAt ??
                (typeof copy.updated_at === "string"
                  ? copy.updated_at
                  : new Date().toISOString()))
              : null;
            return copy;
          })
        : undefined;

      const normalizedPeriods: ActivityPeriod[] | undefined = data
        .activityPeriods?.length
        ? data.activityPeriods.map((period: Record<string, unknown>) => {
            const copy = { ...period };
            copy.note = normalizeSessionNote(
              typeof copy.note === "string" ? copy.note : null
            );
            return copy;
          })
        : undefined;

      await importBackup({
        activityGroups: data.activityGroups as ActivityGroup[] | undefined,
        activities: normalizedActivities,
        dailyEntries: data.dailyEntries as DailyEntry[] | undefined,
        activityPeriods: normalizedPeriods,
        journalEntries: data.journalEntries as JournalEntry[] | undefined,
        oneTimeTasks: data.oneTimeTasks as OneTimeTask[] | undefined,
        activityStatusEvents: data.activityStatusEvents as
          | ActivityStatusEvent[]
          | undefined,
        groupStatusEvents: data.groupStatusEvents as
          | GroupStatusEvent[]
          | undefined,
      });

      setImportMessage("Backup imported successfully!");
      setImportStatus("success");
    } catch (err) {
      logError("Import failed", err);
      setImportMessage(getErrorMessage(err, ERROR_MESSAGES.IMPORT));
      setImportStatus("error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setImportStatus("idle"), 4000);
    }
  };

  return {
    fileInputRef,
    exportStatus,
    importStatus,
    importMessage,
    handleExport,
    handleImport,
  };
}
