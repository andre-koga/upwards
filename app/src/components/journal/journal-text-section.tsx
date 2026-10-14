import type { ReactNode } from "react";
import { Flame, MapPin, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LocationData } from "@/lib/db/types";
import { Button } from "@/components/ui/button";

interface JournalTextSectionProps {
  /** The day's emoji; a quiet placeholder shows until one is chosen. */
  emoji?: string;
  /** Sits at the end of the heading row (the photo stack). */
  trailing?: ReactNode;
  title: string;
  text: string;
  /** Distinct places visited that day (unordered). */
  locations?: LocationData[];
  /** Opens the places editor (search / manage). */
  onLocationsEditClick?: () => void;
  /** Opens the fullscreen places map. */
  onPlacesMapClick?: () => void;
  /** Shown next to location when the day’s journal is complete. */
  journalCompletionStreak?: number | null;
}

export default function JournalTextSection({
  emoji,
  trailing,
  title,
  text,
  locations,
  onLocationsEditClick,
  onPlacesMapClick,
  journalCompletionStreak,
}: JournalTextSectionProps) {
  const { t } = useTranslation("journal");
  const showStreak = typeof journalCompletionStreak === "number";
  const hasLocations = Boolean(locations?.length);
  const canEditLocations = typeof onLocationsEditClick === "function";
  const canOpenMap = typeof onPlacesMapClick === "function" && hasLocations;

  const showMetaRow = canEditLocations || showStreak || hasLocations;

  const streakLabel = t("journalStreak", {
    count: journalCompletionStreak ?? 0,
  });

  const chipClassName =
    "inline-flex h-6 max-w-full items-center gap-1 rounded-full px-2 text-left text-xs font-normal leading-none text-muted-foreground shadow-none";

  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center text-4xl leading-none ${emoji ? "" : "opacity-40 grayscale"}`}
          aria-hidden
        >
          {emoji || "🙂"}
        </span>
        <h2
          className={`flex min-h-12 min-w-0 flex-1 items-center break-words font-display text-3xl font-semibold leading-tight tracking-[-0.02em] ${
            title ? "" : "text-muted-foreground"
          }`}
        >
          {title || t("untitled")}
        </h2>
        {trailing ? <div className="shrink-0 pr-1">{trailing}</div> : null}
      </div>

      <p
        className={`w-full whitespace-pre-wrap text-left font-display text-lg leading-relaxed ${
          text ? "" : "italic text-muted-foreground"
        }`}
      >
        {text || t("noReflection")}
      </p>

      {showMetaRow && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {hasLocations
            ? locations!.map((loc, index) => {
                const label = loc.displayName;
                if (canOpenMap) {
                  return (
                    <Button
                      key={`${index}-${label}-${loc.lat ?? ""}-${loc.lon ?? ""}`}
                      type="button"
                      variant="outline"
                      onClick={onPlacesMapClick}
                      className={chipClassName}
                      title={t("locations.openFullscreenMap")}
                      aria-label={`${label}. ${t("locations.openFullscreenMap")}`}
                    >
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="min-w-0 truncate">{label}</span>
                    </Button>
                  );
                }
                return (
                  <span
                    key={`${index}-${label}-${loc.lat ?? ""}-${loc.lon ?? ""}`}
                    className={`${chipClassName} border border-border`}
                    title={label}
                  >
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">{label}</span>
                  </span>
                );
              })
            : null}

          {canEditLocations ? (
            <Button
              type="button"
              variant="outline"
              onClick={onLocationsEditClick}
              className={chipClassName}
              title={t("addLocationsVisited")}
              aria-label={t("addLocationsVisited")}
            >
              {hasLocations ? (
                <Plus className="h-3 w-3 shrink-0" />
              ) : (
                <>
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{t("addLocations")}</span>
                </>
              )}
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
    </>
  );
}
