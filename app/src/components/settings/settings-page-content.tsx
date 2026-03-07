import { Link } from "react-router-dom";
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
  X,
} from "lucide-react";
import { useDataBackup } from "@/components/settings/use-data-backup";

export default function SettingsPageContent() {
  const {
    fileInputRef,
    exportStatus,
    importStatus,
    importMessage,
    handleExport,
    handleImport,
  } = useDataBackup();

  return (
    <div className="space-y-4 p-4 pb-24">
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

      {/* Fixed bottom-left home button */}
      <Link
        to="/"
        className="fixed bottom-6 left-6 z-50 h-10 w-10 flex items-center justify-center rounded-full bg-background border border-border shadow-md text-muted-foreground hover:text-foreground transition-colors"
        title="Home"
      >
        <X className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
