import type { ReactNode } from "react";
import { Flame, MapPin, PenLine, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LocationData } from "@/lib/db/types";
import { Button } from "@/components/ui/button";

interface JournalTextSectionProps {
  /** The day's emoji; nothing shows until one is chosen. */
  emoji?: string;
  /** Sits under the text (the photos, when a clip holds the top). */
  trailing?: ReactNode;
  title: string;
  text: string;
  /** Today reads "How did today go?", another day "Nothing written". */
  isToday?: boolean;
  /** Distinct places visited that day (unordered). */
  locations?: LocationData[];
  /** Opens the places editor (search / manage). */
  onLocationsEditClick?: () => void;
  /** Opens the fullscreen places map. */
  onPlacesMapClick?: () => void;
  /** Shown next to location when the day’s journal is complete. */
  journalCompletionStreak?: number | null;
  /** Trailing controls on the footer row (heart, edit, versions). */
  actions?: ReactNode;
}

const CHIP_CLASS =
  "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border-0 bg-muted/70 px-3.5 text-left text-[0.8125rem] font-normal leading-none text-muted-foreground shadow-none";

export default function JournalTextSection({
  emoji,
  trailing,
  title,
  text,
  isToday = false,
  locations,
  onLocationsEditClick,
  onPlacesMapClick,
  journalCompletionStreak,
  actions,
}: JournalTextSectionProps) {
  const { t } = useTranslation("journal");
  const showStreak = typeof journalCompletionStreak === "number";
  const hasLocations = Boolean(locations?.length);
  const canEditLocations = typeof onLocationsEditClick === "function";
  const canOpenMap = typeof onPlacesMapClick === "function" && hasLocations;
  const isEmpty = !title && !text && !emoji;

  const streakLabel = t("journalStreak", {
    count: journalCompletionStreak ?? 0,
  });

  return (
    <div className="space-y-7">
      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="font-display text-[1.75rem] italic leading-[1.3] tracking-[-0.01em] text-foreground/85">
            {isToday ? t("prompt.today") : t("prompt.past")}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <PenLine className="h-3.5 w-3.5" aria-hidden />
            {t("prompt.hint")}
          </p>
          {trailing ? <div className="w-full pt-3">{trailing}</div> : null}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center">
            {emoji ? (
              <span className="mb-3 text-5xl leading-none" aria-hidden>
                {emoji}
              </span>
            ) : null}
            <h2 className="break-words font-display text-[2rem] font-medium leading-[1.2] tracking-[-0.02em]">
              <span className={title ? "" : "text-muted-foreground"}>
                {title || t("untitled")}
              </span>
            </h2>
            <span className="mt-5 h-px w-10 bg-foreground/25" aria-hidden />
          </div>

          {text ? (
            <p className="whitespace-pre-wrap text-left font-display text-[1.1875rem] leading-[1.85] text-foreground/85">
              {text}
            </p>
          ) : (
            <p className="text-center font-display text-lg italic text-muted-foreground">
              {t("noReflection")}
            </p>
          )}

          {trailing ? <div className="pt-1">{trailing}</div> : null}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {hasLocations
            ? locations!.map((loc, index) => {
                const label = loc.displayName;
                const key = `${index}-${label}-${loc.lat ?? ""}-${loc.lon ?? ""}`;
                if (canOpenMap) {
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant="ghost"
                      onClick={onPlacesMapClick}
                      className={CHIP_CLASS}
                      title={t("locations.openFullscreenMap")}
                      aria-label={`${label}. ${t("locations.openFullscreenMap")}`}
                    >
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="min-w-0 truncate">{label}</span>
                    </Button>
                  );
                }
                return (
                  <span key={key} className={CHIP_CLASS} title={label}>
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">{label}</span>
                  </span>
                );
              })
            : null}

          {canEditLocations ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onLocationsEditClick}
              className={hasLocations ? `${CHIP_CLASS} w-8 px-0` : CHIP_CLASS}
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
              className="inline-flex shrink-0 items-center gap-0.5 px-1 tabular-nums"
              title={streakLabel}
              aria-label={streakLabel}
            >
              <Flame className="h-3 w-3 shrink-0" />
              {journalCompletionStreak}
            </span>
          )}
        </div>
        {actions}
      </div>
    </div>
  );
}
