import { Flame, MapPin } from "lucide-react";
import type { LocationData } from "@/lib/db/types";

interface JournalTextSectionProps {
  title: string;
  text: string;
  /** Ordered places visited that day (shown as A → B → C). */
  locations?: LocationData[];
  onLocationsClick?: () => void;
  /** Shown next to location when the day’s journal is complete. */
  journalCompletionStreak?: number | null;
}

export default function JournalTextSection({
  title,
  text,
  locations,
  onLocationsClick,
  journalCompletionStreak,
}: JournalTextSectionProps) {
  const showStreak = typeof journalCompletionStreak === "number";
  const hasLocations = Boolean(locations?.length);
  const canOpenLocations = typeof onLocationsClick === "function";

  const showMetaRow = canOpenLocations || showStreak;

  const locationLabel = locations?.length
    ? locations.map((l) => l.displayName).join(" → ")
    : "";

  return (
    <>
      {showMetaRow && (
        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
          {canOpenLocations ? (
            <button
              type="button"
              onClick={onLocationsClick}
              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border px-2 py-px text-left transition-colors hover:bg-accent/40"
              title={hasLocations ? locationLabel : "Add locations visited"}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="min-w-0 break-words">
                {hasLocations ? locationLabel : "Add locations"}
              </span>
            </button>
          ) : null}
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
