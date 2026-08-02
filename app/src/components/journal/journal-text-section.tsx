import { Flame, MapPin, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LocationData } from "@/lib/db/types";
import { Button } from "@/components/ui/button";

interface JournalTextSectionProps {
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
    "inline-flex h-auto max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-left text-xs font-normal text-muted-foreground shadow-none";

  return (
    <>
      {showMetaRow && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs text-muted-foreground">
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
