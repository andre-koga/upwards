import { useRef, useState } from "react";
import { db } from "@/lib/db";
import { getErrorMessage, logError, ERROR_MESSAGES } from "@/lib/error-utils";

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
      ] = await Promise.all([
        db.activityGroups.toArray(),
        db.activities.toArray(),
        db.dailyEntries.toArray(),
        db.activityPeriods.toArray(),
        db.journalEntries.toArray(),
        db.oneTimeTasks.toArray(),
      ]);

      const backup = {
        exportedAt: new Date().toISOString(),
        version: 1,
        activityGroups,
        activities,
        dailyEntries,
        activityPeriods,
        journalEntries,
        oneTimeTasks,
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

      await db.transaction(
        "rw",
        [
          db.activityGroups,
          db.activities,
          db.dailyEntries,
          db.activityPeriods,
          db.journalEntries,
          db.oneTimeTasks,
        ],
        async () => {
          if (data.activityGroups?.length)
            await db.activityGroups.bulkPut(data.activityGroups);
          if (data.activities?.length)
            await db.activities.bulkPut(data.activities);
          if (data.dailyEntries?.length)
            await db.dailyEntries.bulkPut(data.dailyEntries);
          if (data.activityPeriods?.length)
            await db.activityPeriods.bulkPut(data.activityPeriods);
          if (data.journalEntries?.length)
            await db.journalEntries.bulkPut(data.journalEntries);
          if (data.oneTimeTasks?.length)
            await db.oneTimeTasks.bulkPut(data.oneTimeTasks);
        }
      );

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
