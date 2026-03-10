import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, CheckCircle, AlertCircle } from "lucide-react";
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
  );
}
