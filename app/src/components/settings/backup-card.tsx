import { Download, Upload, CheckCircle, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { useDataBackup } from "./use-data-backup";

export function BackupCard() {
  const {
    fileInputRef,
    exportStatus,
    importStatus,
    importMessage,
    handleExport,
    handleImport,
  } = useDataBackup();

  return (
    <SettingsSection
      title="Data backup"
      icon={Download}
      description="Export all your data as a JSON file or restore from a previous backup."
    >
      <Button
        variant="outline"
        className="flex w-full items-center gap-2"
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
            : "Export backup"}
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
          className="flex w-full items-center gap-2"
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
              : "Import backup"}
        </Button>
        {importMessage && (
          <p
            className={`mt-2 text-center text-xs ${
              importStatus === "error" ? "text-destructive" : "text-green-600"
            }`}
          >
            {importMessage}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
