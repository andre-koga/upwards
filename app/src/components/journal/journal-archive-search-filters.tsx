import { useState } from "react";
import {
  CalendarDays,
  Globe2,
  Heart,
  Image,
  MapPin,
  Video,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import JournalArchiveDateFilterDialog from "@/components/journal/journal-archive-date-filter-dialog";
import {
  cycleJournalArchiveTriFilter,
  formatJournalArchiveDateRangeLabel,
  type JournalArchiveDateRange,
  type JournalArchiveFilterKey,
  type JournalArchiveFilters,
  type JournalArchiveTriFilter,
} from "@/lib/journal/archive";
import { cn } from "@/lib/utils";

interface JournalArchiveSearchFiltersProps {
  filters: JournalArchiveFilters;
  onChange: (next: JournalArchiveFilters) => void;
  availableYears: number[];
  entryDates: Set<string>;
  bookmarkedDates: Set<string>;
}

const FILTER_KEYS: JournalArchiveFilterKey[] = [
  "bookmarked",
  "hasPhotos",
  "hasVideo",
  "hasPlaces",
];

function FilterIcon({
  filterKey,
  className,
}: {
  filterKey: JournalArchiveFilterKey;
  className?: string;
}) {
  if (filterKey === "bookmarked") {
    return <Heart className={className} aria-hidden />;
  }
  if (filterKey === "hasPhotos") {
    return <Image className={className} aria-hidden />;
  }
  if (filterKey === "hasVideo") {
    return <Video className={className} aria-hidden />;
  }
  return <MapPin className={className} aria-hidden />;
}

function chipClassName(value: JournalArchiveTriFilter): string {
  if (value === "yes") {
    return "border-primary bg-primary/10 text-primary";
  }
  if (value === "no") {
    return "border-dashed border-muted-foreground/50 text-muted-foreground line-through decoration-muted-foreground/70";
  }
  return "border-border text-muted-foreground";
}

function dateRangeChipLabel(
  range: JournalArchiveDateRange,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (range.preset === "thisMonth") {
    return t("archive.filters.dates.thisMonth");
  }
  if (range.preset === "last30") {
    return t("archive.filters.dates.last30");
  }
  if (range.preset === "last90") {
    return t("archive.filters.dates.last90");
  }
  return formatJournalArchiveDateRangeLabel(range);
}

/**
 * Compact structured filters under archive search.
 * Each attribute chip cycles any → yes → no → any.
 * Dates opens a dialog; map cluster selection is clearable.
 */
export default function JournalArchiveSearchFilters({
  filters,
  onChange,
  availableYears,
  entryDates,
  bookmarkedDates,
}: JournalArchiveSearchFiltersProps) {
  const { t } = useTranslation("journal");
  const [datesOpen, setDatesOpen] = useState(false);
  const hasStructuredFilters =
    filters.bookmarked !== "any" ||
    filters.hasPhotos !== "any" ||
    filters.hasVideo !== "any" ||
    filters.hasPlaces !== "any";
  const mapSelectionCount = filters.mapEntryDates?.length ?? 0;
  const hasMapSelection = mapSelectionCount > 0;
  const hasDateRange = Boolean(filters.dateRange);

  const cycle = (key: JournalArchiveFilterKey) => {
    onChange({
      ...filters,
      [key]: cycleJournalArchiveTriFilter(filters[key]),
    });
  };

  const clearStructured = () => {
    onChange({
      ...filters,
      bookmarked: "any",
      hasPhotos: "any",
      hasVideo: "any",
      hasPlaces: "any",
    });
  };

  const clearMapSelection = () => {
    onChange({
      ...filters,
      mapEntryDates: null,
      mapPlaceLabel: null,
    });
  };

  const clearDateRange = () => {
    onChange({
      ...filters,
      dateRange: null,
    });
  };

  const applyDateRange = (range: JournalArchiveDateRange | null) => {
    onChange({
      ...filters,
      dateRange: range,
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {hasMapSelection ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearMapSelection}
            className="h-7 gap-1 rounded-full border-primary bg-primary/10 px-2.5 text-xs font-medium text-primary shadow-none"
            title={t("archive.filters.mapSelection.hint")}
            aria-label={t("archive.filters.mapSelection.clearAria", {
              place: filters.mapPlaceLabel ?? "",
              count: mapSelectionCount,
            })}
          >
            <Globe2 className="h-3 w-3 shrink-0" aria-hidden />
            <span>
              {t("archive.filters.mapSelection.label", {
                place: filters.mapPlaceLabel ?? "",
                count: mapSelectionCount,
              })}
            </span>
            <X className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          </Button>
        ) : null}

        <div
          className={cn(
            "inline-flex items-center",
            hasDateRange && "rounded-full"
          )}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDatesOpen(true)}
            className={cn(
              "h-7 gap-1 px-2.5 text-xs font-medium shadow-none",
              hasDateRange
                ? "rounded-l-full rounded-r-none border-primary border-r-0 bg-primary/10 text-primary"
                : "rounded-full border-border text-muted-foreground"
            )}
            aria-pressed={hasDateRange}
            title={t("archive.filters.dates.hint")}
            aria-label={
              hasDateRange && filters.dateRange
                ? t("archive.filters.dates.activeAria", {
                    label: dateRangeChipLabel(filters.dateRange, t),
                  })
                : t("archive.filters.dates.openAria")
            }
          >
            <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
            <span>
              {hasDateRange && filters.dateRange
                ? dateRangeChipLabel(filters.dateRange, t)
                : t("archive.filters.dates.label")}
            </span>
          </Button>
          {hasDateRange ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearDateRange}
              className="h-7 rounded-l-none rounded-r-full border-primary bg-primary/10 px-1.5 text-primary shadow-none"
              title={t("archive.filters.dates.clear")}
              aria-label={t("archive.filters.dates.clear")}
            >
              <X className="h-3 w-3" aria-hidden />
            </Button>
          ) : null}
        </div>

        {FILTER_KEYS.map((key) => {
          const value = filters[key];
          const label = t(`archive.filters.${key}.${value}`);
          return (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cycle(key)}
              className={cn(
                "h-7 gap-1 rounded-full px-2.5 text-xs font-medium shadow-none",
                chipClassName(value)
              )}
              aria-pressed={value !== "any"}
              title={t(`archive.filters.${key}.hint`)}
              aria-label={label}
            >
              <FilterIcon
                filterKey={key}
                className={cn(
                  "h-3 w-3 shrink-0",
                  key === "bookmarked" && value === "yes" && "fill-current"
                )}
              />
              <span>{t(`archive.filters.${key}.label`)}</span>
            </Button>
          );
        })}

        {hasStructuredFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearStructured}
            className="h-7 gap-1 rounded-full px-2 text-xs text-muted-foreground shadow-none"
            title={t("archive.filters.clear")}
            aria-label={t("archive.filters.clear")}
          >
            <X className="h-3 w-3" aria-hidden />
            {t("archive.filters.clear")}
          </Button>
        ) : null}
      </div>

      <JournalArchiveDateFilterDialog
        open={datesOpen}
        onOpenChange={setDatesOpen}
        value={filters.dateRange}
        onApply={applyDateRange}
        availableYears={availableYears}
        entryDates={entryDates}
        bookmarkedDates={bookmarkedDates}
      />
    </>
  );
}
