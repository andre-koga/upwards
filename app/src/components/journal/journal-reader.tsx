import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { JournalEntry } from "@/lib/db/types";
import JournalArchivePhotoGrid from "@/components/journal/journal-archive-photos";
import JournalEditedNote from "@/components/journal/journal-edited-note";
import {
  JournalEntryClip,
  JournalEntryPlaces,
} from "@/components/journal/journal-entry-media";
import { Button } from "@/components/ui/button";
import { normalizeJournalLocationRoute } from "@/lib/journal";
import { rememberJournalJumpDate } from "@/lib/journal/archive";
import type { RevisionSummary } from "@/lib/journal/revisions";
import { getActiveLocaleTag } from "@/lib/i18n";
import { formatWeekdayShortDate, fromDateString } from "@/lib/time-utils";

/** Photos shown before the rest fold into a "+N" tile; the rail is narrow. */
const READER_PHOTO_PREVIEW = 6;

interface JournalReaderProps {
  /** The day being read; null until one is chosen. */
  date: string | null;
  /** That day's entry among the days in view, or null if none is. */
  entry: JournalEntry | null;
  revisions?: RevisionSummary;
  onOpenVersions: (entryDate: string) => void;
}

/**
 * The context rail of the Journal at `lg`: one day, read at full size beside
 * the list that chose it. It is the editorial register throughout: the day's
 * own words in serif with room around them. Editing still happens on Today,
 * one button away.
 */
export default function JournalReader({
  date,
  entry,
  revisions,
  onOpenVersions,
}: JournalReaderProps) {
  const { t } = useTranslation("journal");
  const navigate = useNavigate();

  const openDay = (target: string) => {
    rememberJournalJumpDate(target);
    navigate("/");
  };

  if (!date) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        {t("reader.hint")}
      </p>
    );
  }

  const day = fromDateString(date);
  const longDate = day.toLocaleDateString(getActiveLocaleTag(), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!entry) {
    return (
      <div className="space-y-3 rounded-2xl border border-dashed border-border p-5">
        <p className="text-sm text-muted-foreground">
          {t("archive.calendar.noEntry", {
            date: `${formatWeekdayShortDate(day)} ${day.getFullYear()}`,
          })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openDay(date)}
        >
          {t("archive.calendar.openDay")}
        </Button>
      </div>
    );
  }

  const locations = normalizeJournalLocationRoute(
    entry.location ?? { locations: [] }
  ).locations;
  const text = entry.text_content?.trim();
  const photoPaths = entry.photo_paths ?? [];

  return (
    <article
      aria-label={t("reader.label", { date: longDate })}
      className="space-y-4 rounded-2xl border border-border bg-card p-5"
    >
      <header className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>{longDate}</span>
          {entry.is_bookmarked ? (
            <>
              <Heart
                className="h-3.5 w-3.5 fill-red-500 text-red-500"
                aria-hidden
              />
              <span className="sr-only">{t("bookmarkDay")}</span>
            </>
          ) : null}
        </p>
        <div className="flex items-start gap-3">
          <span className="text-5xl leading-none" aria-hidden>
            {entry.day_emoji?.trim() || "🙂"}
          </span>
          <h2 className="min-w-0 font-display text-3xl leading-tight tracking-tight">
            {entry.title?.trim() || t("untitled")}
          </h2>
        </div>
      </header>

      <p
        className={
          text
            ? "whitespace-pre-wrap font-display text-lg leading-relaxed"
            : "font-display text-lg italic leading-relaxed text-muted-foreground"
        }
      >
        {text || t("noReflection")}
      </p>

      <JournalEntryPlaces locations={locations} />
      <JournalEntryClip entry={entry} />
      <JournalArchivePhotoGrid
        photoPaths={photoPaths}
        previewLimit={READER_PHOTO_PREVIEW}
      />

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        {revisions ? (
          <JournalEditedNote
            summary={revisions}
            onOpen={() => onOpenVersions(entry.entry_date)}
          />
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openDay(entry.entry_date)}
        >
          {t("reader.openDay")}
        </Button>
      </footer>
    </article>
  );
}
