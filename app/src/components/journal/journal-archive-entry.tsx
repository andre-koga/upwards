import { Heart, Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { JournalEntry } from "@/lib/db/types";
import { normalizeJournalLocationRoute } from "@/lib/journal";
import { rememberJournalJumpDate } from "@/lib/journal/archive";
import { heartedWashStyle } from "@/lib/journal/hearted-wash";
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
      data-hearted={isBookmarked ? "true" : undefined}
      style={isBookmarked ? heartedWashStyle(entry.entry_date) : undefined}
      className={cn(
        "duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
        isBookmarked
          ? "-mx-1.5 rounded-3xl px-1.5 py-3 ring-1 ring-inset ring-foreground/5"
          : "py-1",
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
            <span className="font-display text-4xl font-medium tabular-nums leading-none tracking-tight text-foreground transition-colors group-hover:text-primary">
              {dayNumber}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
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
            <>
              <Heart
                className="h-3.5 w-3.5 fill-terracotta text-terracotta"
                aria-hidden
              />
              <span className="sr-only">{t("bookmarkDay")}</span>
            </>
          ) : null}
        </div>

        <div
          className={cn(
            "-mx-1 min-w-0 overflow-hidden rounded-xl",
            selected && "bg-muted/60"
          )}
        >
          <button
            type="button"
            onClick={choose}
            className="group w-full space-y-1 px-1 pb-2 pt-1 text-left"
            {...selectProps}
          >
            <h2 className="font-display text-[1.375rem] font-medium leading-snug tracking-[-0.01em]">
              {entry.title?.trim() || t("untitled")}
            </h2>
            {entry.text_content?.trim() ? (
              <p
                className={cn(
                  "whitespace-pre-wrap font-display text-[1.0625rem] leading-relaxed text-foreground/75",
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
              className="flex flex-wrap gap-1.5 px-1 pb-2"
            />
          ) : null}

          {compact ? (
            photoPaths.length > 0 ? (
              <p className="flex items-center gap-1 px-1 pb-2 text-xs text-muted-foreground">
                <ImageIcon className="h-3 w-3" aria-hidden />
                <span>
                  {t("archive.photoCount", { count: photoPaths.length })}
                </span>
              </p>
            ) : null
          ) : (
            <div className="space-y-1.5 px-1 pb-2 empty:hidden">
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
