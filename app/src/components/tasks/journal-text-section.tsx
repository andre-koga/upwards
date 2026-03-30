import { Flame, MapPin } from "lucide-react";
import type { LocationData } from "@/lib/db/types";

interface JournalTextSectionProps {
  title: string;
  text: string;
  location?: LocationData;
  /** Shown next to location when the day’s journal is complete. */
  journalCompletionStreak?: number | null;
}

export default function JournalTextSection({
  title,
  text,
  location,
  journalCompletionStreak,
}: JournalTextSectionProps) {
  const showStreak = typeof journalCompletionStreak === "number";

  const showMetaRow = Boolean(location) || showStreak;

  return (
    <>
      {showMetaRow && (
        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
          {location ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location.displayName}</span>
            </span>
          ) : (
            <span />
          )}
          {showStreak && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 tabular-nums"
              title={`Journal streak: ${journalCompletionStreak}`}
              aria-label={`Journal streak: ${journalCompletionStreak}`}
            >
              <Flame className="h-3 w-3 shrink-0" />
              {journalCompletionStreak}
            </span>
          )}
        </div>
      )}

      <p
        className={`pb-2 text-left font-crimson text-3xl font-bold ${
          title ? "" : "text-muted-foreground/30"
        } ${showMetaRow ? "pt-2" : "pt-3"}`}
      >
        {title || "Untitled"}
      </p>

      <p
        className={`w-full whitespace-pre-wrap text-left font-crimson text-base leading-relaxed ${
          text ? "text-muted-foreground" : "italic text-muted-foreground/30"
        }`}
      >
        {text || "No reflection written."}
      </p>
    </>
  );
}
