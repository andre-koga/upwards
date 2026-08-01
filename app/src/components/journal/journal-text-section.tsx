import { Flame, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LocationData } from "@/lib/db/types";
import { Button } from "@/components/ui/button";

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
  const { t } = useTranslation("journal");
  const showStreak = typeof journalCompletionStreak === "number";
  const hasLocations = Boolean(locations?.length);
  const canOpenLocations = typeof onLocationsClick === "function";

  const showMetaRow = canOpenLocations || showStreak;

  const locationLabel = locations?.length
    ? locations.map((l) => l.displayName).join(" → ")
    : "";

  const streakLabel = t("journalStreak", {
    count: journalCompletionStreak ?? 0,
  });

  return (
    <>
      {showMetaRow && (
        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
          {canOpenLocations ? (
            <Button
              type="button"
              variant="outline"
              onClick={onLocationsClick}
              className="inline-flex h-auto min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-px text-left text-xs font-normal text-muted-foreground shadow-none"
              title={hasLocations ? locationLabel : t("addLocationsVisited")}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="min-w-0 break-words">
                {hasLocations ? locationLabel : t("addLocations")}
              </span>
            </Button>
          ) : null}
          {showStreak && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 tabular-nums"
              title={streakLabel}
              aria-label={streakLabel}
            >
              <Flame className="h-3 w-3 shrink-0" />
              {journalCompletionStreak}
            </span>
          )}
        </div>
      )}

      <p
        className={`pb-2 text-left font-crimson text-3xl font-bold ${
          title ? "" : "text-muted-foreground"
        } ${showMetaRow ? "pt-2" : "pt-3"}`}
      >
        {title || t("untitled")}
      </p>

      <p
        className={`w-full whitespace-pre-wrap text-left font-crimson text-base leading-relaxed ${
          text ? "text-muted-foreground" : "italic text-muted-foreground"
        }`}
      >
        {text || t("noReflection")}
      </p>
    </>
  );
}
