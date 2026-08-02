import { Heart, Image, MapPin, Video, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  cycleJournalArchiveTriFilter,
  journalArchiveFiltersAreActive,
  type JournalArchiveFilterKey,
  type JournalArchiveFilters,
  type JournalArchiveTriFilter,
} from "@/lib/journal/archive";
import { cn } from "@/lib/utils";

interface JournalArchiveSearchFiltersProps {
  filters: JournalArchiveFilters;
  onChange: (next: JournalArchiveFilters) => void;
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

/**
 * Compact structured filters under archive search.
 * Each chip cycles any → yes → no → any.
 */
export default function JournalArchiveSearchFilters({
  filters,
  onChange,
}: JournalArchiveSearchFiltersProps) {
  const { t } = useTranslation("journal");
  const hasActiveFilters = journalArchiveFiltersAreActive({
    ...filters,
    query: "",
  });

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

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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

      {hasActiveFilters ? (
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
  );
}
