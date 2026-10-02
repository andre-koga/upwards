import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Archive, Database, Film, Image, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { SettingsSection } from "@/components/ui/settings-section";
import { useDataBackup } from "@/lib/backup/use-data-backup";
import { cn } from "@/lib/utils";

export function BackupCard() {
  const { t } = useTranslation("settings");
  const {
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
  } = useDataBackup();
  const isBusy = busy != null;
  const spinner = (task: typeof busy, Icon: typeof Database) =>
    busy === task ? (
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
    ) : (
      <Icon className="h-4 w-4" aria-hidden />
    );

  return (
    <SettingsSection
      title={t("backup.title")}
      icon={Archive}
      description={t("backup.description")}
    >
      <div className="space-y-2">
        <SectionLabel>{t("backup.export.label")}</SectionLabel>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => void exportData()}
          >
            {spinner("data", Database)}
            {t("backup.export.data")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => void exportPhotos()}
          >
            {spinner("photos", Image)}
            {t("backup.export.photos")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            aria-expanded={clipYears != null}
            aria-controls="backup-clip-years"
            onClick={() => void toggleClipYears()}
          >
            {spinner("clips", Film)}
            {t("backup.export.clips")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("backup.export.hint")}
        </p>
        {clipYears ? (
          <div id="backup-clip-years" className="space-y-2">
            {clipYears.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("backup.export.noClips")}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {clipYears.map(({ year, count }) => (
                  <li key={year}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => void exportClips(year)}
                    >
                      {t("backup.export.clipsYear", { year, count })}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <SectionLabel>{t("backup.import.label")}</SectionLabel>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          onChange={(e) => void handleImportFile(e)}
          className="hidden"
          tabIndex={-1}
          aria-hidden
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isBusy || importDisabledReason != null}
          aria-describedby="backup-import-hint"
          onClick={chooseImportFile}
        >
          {spinner("import", Upload)}
          {t("backup.import.choose")}
        </Button>
        <p id="backup-import-hint" className="text-xs text-muted-foreground">
          {importDisabledReason ?? t("backup.import.hint")}
        </p>
      </div>

      <div role="status" aria-live="polite" className="space-y-1">
        {progressText ? (
          <p className="text-xs text-muted-foreground">{progressText}</p>
        ) : null}
        {message ? (
          <div
            className={cn(
              "space-y-1 text-xs",
              message.tone === "error"
                ? "text-destructive"
                : "text-green-600 dark:text-green-500"
            )}
          >
            {message.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {message.showSyncIssuesLink ? (
              <Link
                to="/settings/sync-issues"
                className="inline-block rounded-sm text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("backup.openSyncIssues")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </SettingsSection>
  );
}
