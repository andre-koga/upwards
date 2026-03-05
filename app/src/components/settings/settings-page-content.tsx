import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import {
  Sun,
  Archive,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export default function SettingsPageContent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportStatus, setExportStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [importStatus, setImportStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
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
        timeEntries,
      ] = await Promise.all([
        db.activityGroups.toArray(),
        db.activities.toArray(),
        db.dailyEntries.toArray(),
        db.activityPeriods.toArray(),
        db.journalEntries.toArray(),
        db.oneTimeTasks.toArray(),
        db.timeEntries.toArray(),
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
        timeEntries,
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
          db.timeEntries,
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
          if (data.timeEntries?.length)
            await db.timeEntries.bulkPut(data.timeEntries);
        },
      );

      setImportMessage("Backup imported successfully!");
      setImportStatus("success");
    } catch (err) {
      console.error("Import failed:", err);
      setImportMessage(err instanceof Error ? err.message : "Import failed");
      setImportStatus("error");
    } finally {
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setImportStatus("idle"), 4000);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme</span>
            <ThemeSwitcher />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            View and manage your archived activity groups and activities.
          </p>
          <Link to="/settings/archived">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              View Archived Items
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Download className="h-4 w-4" />
            Data Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Export all your data as a JSON file or restore from a previous
            backup.
          </p>

          <Button
            variant="outline"
            className="w-full flex items-center gap-2"
            onClick={handleExport}
          >
            {exportStatus === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : exportStatus === "error" ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportStatus === "success"
              ? "Downloaded!"
              : exportStatus === "error"
                ? "Export failed"
                : "Export Backup"}
          </Button>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              {importStatus === "success" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : importStatus === "error" ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {importStatus === "success"
                ? "Imported!"
                : importStatus === "error"
                  ? "Import failed"
                  : "Import Backup"}
            </Button>
            {importMessage && (
              <p
                className={`text-xs mt-1 text-center ${
                  importStatus === "error"
                    ? "text-destructive"
                    : "text-green-600"
                }`}
              >
                {importMessage}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground pt-4">
        <p>Upwards — local-first habit tracker</p>
      </div>
    </div>
  );
}
