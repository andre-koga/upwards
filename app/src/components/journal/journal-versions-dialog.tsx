import { useState } from "react";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { describeJournalChange } from "@/components/journal/describe-journal-change";
import { useJournalRevisions } from "@/components/journal/hooks/use-journal-revisions";
import { getJournalPhotoUrl } from "@/lib/journal";
import {
  hasJournalChange,
  summarizeJournalChange,
} from "@/lib/journal/old-day-edit";
import {
  formatRevisionMoment,
  restoreJournalRevision,
  revisionFields,
  type RestoreResult,
} from "@/lib/journal/revisions";
import { formatWeekdayShortDate, fromDateString } from "@/lib/time-utils";
import type { JournalEntryRevision } from "@/lib/db/types";

const PHOTO_PREVIEW_LIMIT = 4;

interface JournalVersionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryDate: string;
  /** Called after a restore, so the screen showing the day reads it again. */
  onRestored: () => void;
}

/**
 * The way back for an old journal day: every version it had before a
 * confirmed edit replaced it, newest first, each restorable. Restoring keeps
 * the version it replaces, so nothing here is a one-way door.
 */
export default function JournalVersionsDialog({
  open,
  onOpenChange,
  entryDate,
  onRestored,
}: JournalVersionsDialogProps) {
  const { t } = useTranslation("journal");
  const year = fromDateString(entryDate).getFullYear();

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("versions.title")}
      description={t("versions.description", {
        date: `${formatWeekdayShortDate(fromDateString(entryDate))} ${year}`,
      })}
      size="default"
    >
      <VersionsList entryDate={entryDate} onRestored={onRestored} />
    </FormDialog>
  );
}

function VersionsList({
  entryDate,
  onRestored,
}: {
  entryDate: string;
  onRestored: () => void;
}) {
  const { t } = useTranslation("journal");
  const { loading, failed, revisions, current, reload } =
    useJournalRevisions(entryDate);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: RestoreResult | "error";
  } | null>(null);

  const restore = async (revision: JournalEntryRevision) => {
    if (busyId) return;
    setBusyId(revision.id);
    setNotice(null);
    try {
      const result = await restoreJournalRevision(revision.id);
      setNotice({ kind: result });
      if (result === "restored") onRestored();
      await reload();
    } catch (error) {
      console.error("Error restoring journal version:", error);
      setNotice({ kind: "error" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Always mounted so assistive tech announces the text when it appears. */}
      <p
        role="status"
        className={notice ? "text-sm text-muted-foreground" : "sr-only"}
      >
        {notice ? t(`versions.notice.${notice.kind}`) : ""}
      </p>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("versions.loading")}
        </p>
      ) : failed ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("versions.loadError")}
        </p>
      ) : revisions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("versions.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {revisions.map((revision) => {
            const when = formatRevisionMoment(revision.created_at);
            const change = summarizeJournalChange(
              current,
              revisionFields(revision)
            );
            const same = current !== null && !hasJournalChange(change);
            return (
              <li key={revision.id} className="space-y-2 py-4 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {t("versions.replaced", { when })}
                  </p>
                  {same ? (
                    <span className="text-xs text-muted-foreground">
                      {t("versions.sameAsNow")}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId !== null}
                      aria-label={t("versions.restoreLabel", { when })}
                      onClick={() => void restore(revision)}
                    >
                      <History className="h-3.5 w-3.5" aria-hidden />
                      {t("versions.restore")}
                    </Button>
                  )}
                </div>
                <VersionBody revision={revision} />
                {!same ? (
                  <p className="text-xs text-muted-foreground">
                    {t("versions.restoringChanges", {
                      changes: describeJournalChange(change, t),
                    })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** What the day said in that version, in the same editorial voice as the day. */
function VersionBody({ revision }: { revision: JournalEntryRevision }) {
  const { t } = useTranslation("journal");
  const photos = revision.photo_paths ?? [];
  const shown = photos.slice(0, PHOTO_PREVIEW_LIMIT);
  const hidden = photos.length - shown.length;
  const title = revision.title?.trim();
  const text = revision.text_content?.trim();

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {revision.day_emoji?.trim() || "🙂"}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3
            className={
              title
                ? "font-display text-xl leading-snug tracking-tight"
                : "font-display text-xl leading-snug tracking-tight text-muted-foreground"
            }
          >
            {title || t("untitled")}
          </h3>
          <p
            className={
              text
                ? "whitespace-pre-wrap font-display text-base leading-relaxed text-muted-foreground"
                : "font-display text-base italic leading-relaxed text-muted-foreground"
            }
          >
            {text || t("noReflection")}
          </p>
          {shown.length > 0 || revision.video_path ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {shown.map((path, index) => {
                const url = getJournalPhotoUrl(path);
                return (
                  <span
                    key={path}
                    className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs text-muted-foreground"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={t("upload.photoAlt", { index: index + 1 })}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <span className="sr-only">
                        {t("archive.photoUnavailable")}
                      </span>
                    )}
                  </span>
                );
              })}
              {hidden > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {t("versions.morePhotos", { count: hidden })}
                </span>
              ) : null}
              {revision.video_path ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {t("versions.clip")}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
