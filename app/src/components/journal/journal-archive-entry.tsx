import { Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { JournalEntry } from "@/lib/db/types";
import { normalizeJournalLocationRoute } from "@/lib/journal";
import { rememberJournalJumpDate } from "@/lib/journal/archive";
import { fromDateString } from "@/lib/time-utils";
import { getActiveLocaleTag } from "@/lib/i18n";
import {
  JournalEntryClip,
  JournalEntryPlaces,
} from "@/components/journal/journal-entry-media";
import JournalArchivePhotoGrid from "@/components/journal/journal-archive-photos";
import JournalEditedNote from "@/components/journal/journal-edited-note";
import type { RevisionSummary } from "@/lib/journal/revisions";
import { cn } from "@/lib/utils";

interface JournalArchiveEntryProps {
  entry: JournalEntry;
  /** Briefly emphasize the entry after jumping from the world map. */
  highlighted?: boolean;
  /** Present when the day was changed after the fact and has earlier versions. */
  revisions?: RevisionSummary;
  onOpenVersions?: (entryDate: string) => void;
  /**
   * With a reader beside the list: choosing the card reads the day there
   * instead of leaving for Today. Without it, the card opens the day.
   */
  onSelect?: (entryDate: string) => void;
  /** The day the reader is showing. */
  selected?: boolean;
  /** A scannable row: the words trimmed, and the media left to the reader. */
  compact?: boolean;
}

export default function JournalArchiveEntry({
  entry,
  highlighted = false,
  revisions,
  onOpenVersions,
  onSelect,
  selected = false,
  compact = false,
}: JournalArchiveEntryProps) {
  const { t } = useTranslation("journal");
  const navigate = useNavigate();

  const date = fromDateString(entry.entry_date);
  const dayNumber = date.getDate();
  const weekday = date.toLocaleDateString(getActiveLocaleTag(), {
    weekday: "short",
  });

  const photoPaths = entry.photo_paths ?? [];
  const locations = normalizeJournalLocationRoute(
    entry.location ?? { locations: [] }
  ).locations;
  const isBookmarked = Boolean(entry.is_bookmarked);

  const choose = () => {
    if (onSelect) {
      onSelect(entry.entry_date);
      return;
    }
    rememberJournalJumpDate(entry.entry_date);
    navigate("/");
  };
  const selectProps = onSelect
    ? { "aria-current": selected ? ("true" as const) : undefined }
    : {};

  return (
    <article
      data-journal-entry-date={entry.entry_date}
      className={cn(
        "py-1 duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
        highlighted && "rounded-xl ring-2 ring-primary/40"
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1 pt-1">
          <button
            type="button"
            onClick={choose}
            className="group flex flex-col items-center gap-1 text-left"
            {...selectProps}
          >
            <span className="font-crimson text-4xl font-bold tabular-nums leading-none tracking-tight text-foreground transition-colors group-hover:text-primary">
              {dayNumber}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {weekday}
            </span>
          </button>
          <span
            className={cn(
              "text-4xl leading-none",
              !entry.day_emoji && "text-muted-foreground"
            )}
            aria-hidden
          >
            {entry.day_emoji?.trim() || "🙂"}
          </span>
          {isBookmarked ? (
            <span className="sr-only">{t("bookmarkDay")}</span>
          ) : null}
        </div>

        <div
          className={cn(
            "min-w-0 overflow-hidden rounded-xl border",
            selected ? "border-primary/60 bg-muted/40" : "border-border/70"
          )}
        >
          <button
            type="button"
            onClick={choose}
            className="group w-full space-y-1 px-3 py-2.5 text-left"
            {...selectProps}
          >
            <h2 className="font-crimson text-2xl font-bold leading-snug tracking-tight">
              {entry.title?.trim() || t("untitled")}
            </h2>
            {entry.text_content?.trim() ? (
              <p
                className={cn(
                  "whitespace-pre-wrap font-crimson text-base leading-relaxed text-muted-foreground",
                  compact && "line-clamp-3"
                )}
              >
                {entry.text_content}
              </p>
            ) : null}
          </button>

          {locations.length > 0 ? (
            <JournalEntryPlaces
              locations={locations}
              className="flex flex-wrap gap-1.5 px-3 pb-2.5"
            />
          ) : null}

          {compact ? (
            photoPaths.length > 0 ? (
              <p className="flex items-center gap-1 px-3 pb-2.5 text-xs text-muted-foreground">
                <ImageIcon className="h-3 w-3" aria-hidden />
                <span>
                  {t("archive.photoCount", { count: photoPaths.length })}
                </span>
              </p>
            ) : null
          ) : (
            <div className="space-y-1.5 px-3 pb-2.5 empty:hidden">
              <JournalEntryClip entry={entry} />
              <JournalArchivePhotoGrid photoPaths={photoPaths} />
            </div>
          )}

          {revisions && onOpenVersions ? (
            <div className="px-1 pb-1">
              <JournalEditedNote
                summary={revisions}
                onOpen={() => onOpenVersions(entry.entry_date)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
