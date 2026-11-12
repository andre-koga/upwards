import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, Database, Film, Image, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SettingsActionRow,
  SettingsGroup,
} from "@/components/settings/settings-list";
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
  return (
    <SettingsGroup
      title={t("backup.title")}
      footer={
        <div className="space-y-1">
          <p>{t("backup.description")}</p>
          <p id="backup-import-hint">
            {importDisabledReason ?? t("backup.import.hint")}
          </p>
        </div>
      }
    >
      <SettingsActionRow
        icon={Database}
        busy={busy === "data"}
        label={t("backup.export.data")}
        hint={t("backup.export.hint")}
        disabled={isBusy}
        onClick={() => void exportData()}
      />
      <SettingsActionRow
        icon={Image}
        busy={busy === "photos"}
        label={t("backup.export.photos")}
        disabled={isBusy}
        onClick={() => void exportPhotos()}
      />
      <SettingsActionRow
        icon={Film}
        busy={busy === "clips"}
        label={t("backup.export.clips")}
        disabled={isBusy}
        onClick={() => void toggleClipYears()}
        trailing={
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform",
              clipYears != null && "rotate-180"
            )}
            aria-hidden
          />
        }
        expanded={clipYears != null}
        controls="backup-clip-years"
      />
      {clipYears ? (
        <div id="backup-clip-years" className="px-4 py-3">
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
                    className="h-8 rounded-full bg-background/70 px-3"
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
      <SettingsActionRow
        icon={Upload}
        busy={busy === "import"}
        label={t("backup.import.choose")}
        disabled={isBusy || importDisabledReason != null}
        describedBy="backup-import-hint"
        onClick={chooseImportFile}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.json,application/zip,application/json"
        onChange={(e) => void handleImportFile(e)}
        className="hidden"
        tabIndex={-1}
        aria-hidden
      />

      {progressText || message ? (
        <div role="status" aria-live="polite" className="space-y-1 px-4 py-3">
          {progressText ? (
            <p className="text-xs text-muted-foreground">{progressText}</p>
          ) : null}
          {message ? (
            <div
              className={cn(
                "space-y-1 text-xs",
                message.tone === "error" ? "text-destructive" : "text-green"
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
      ) : null}
    </SettingsGroup>
  );
}
