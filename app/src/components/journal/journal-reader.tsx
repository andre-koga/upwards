import { Heart } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { JournalEntry, Memory } from "@/lib/db/types";
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
  /** Memories remembered on that day, which stand beneath its entry. */
  memories: readonly Memory[];
  renderMemory: (memory: Memory) => ReactNode;
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
  memories,
  renderMemory,
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

  if (!entry && memories.length > 0) {
    return (
      <div className="space-y-6">
        <h2 className="px-3 pt-2 text-center text-[0.75rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {longDate}
        </h2>
        {memories.map(renderMemory)}
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex flex-col items-center space-y-4 px-3 py-8 text-center">
        <p className="font-display text-[1.0625rem] italic leading-relaxed text-muted-foreground">
          {t("archive.calendar.noEntry", {
            date: `${formatWeekdayShortDate(day)} ${day.getFullYear()}`,
          })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3.5"
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
    <div className="space-y-8">
      <article
        aria-label={t("reader.label", { date: longDate })}
        className="space-y-6 px-3 py-2"
      >
        <header className="flex flex-col items-center text-center">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <span>{longDate}</span>
            {entry.is_bookmarked ? (
              <>
                <Heart
                  className="h-3 w-3 fill-terracotta text-terracotta"
                  aria-hidden
                />
                <span className="sr-only">{t("bookmarkDay")}</span>
              </>
            ) : null}
          </p>
          <span className="mt-5 text-[2.75rem] leading-none" aria-hidden>
            {entry.day_emoji?.trim() || "🙂"}
          </span>
          <h2 className="mt-4 max-w-[22rem] text-balance font-display text-[2rem] font-medium leading-[1.15] tracking-[-0.02em]">
            {entry.title?.trim() || t("untitled")}
          </h2>
          <span className="mt-5 h-px w-10 bg-foreground/25" aria-hidden />
        </header>

        <p
          className={
            text
              ? "whitespace-pre-wrap font-display text-[1.125rem] leading-[1.85]"
              : "text-center font-display text-lg italic leading-relaxed text-muted-foreground"
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

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/[0.07] pt-4">
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
            className="h-8 rounded-full px-3.5"
            onClick={() => openDay(entry.entry_date)}
          >
            {t("reader.openDay")}
          </Button>
        </footer>
      </article>
      {memories.map(renderMemory)}
    </div>
  );
}
