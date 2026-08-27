import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Search, X } from "lucide-react";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useJournalArchive } from "@/hooks/use-journal-archive";
import JournalArchiveEntry from "@/components/journal/journal-archive-entry";
import JournalArchiveBanner from "@/components/journal/journal-archive-banner";
import JournalArchiveWorldMap, {
  type JournalArchiveMapClusterSelection,
} from "@/components/journal/journal-archive-world-map";
import JournalArchiveSearchFilters from "@/components/journal/journal-archive-search-filters";
import {
  DEFAULT_JOURNAL_ARCHIVE_FILTERS,
  formatArchiveMonthLabel,
  journalArchiveFiltersAreActive,
  type JournalArchiveFilters,
} from "@/lib/journal/archive";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";

export default function JournalPage() {
  const { t } = useTranslation("journal");
  const { t: tNav } = useTranslation("nav");
  const [filters, setFilters] = useState<JournalArchiveFilters>(
    DEFAULT_JOURNAL_ARCHIVE_FILTERS
  );
  const [searchInput, setSearchInput] = useState("");
  const [mapJumpDate, setMapJumpDate] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((prev) => {
        const nextQuery = searchInput.trim();
        if (prev.query === nextQuery) return prev;
        return { ...prev, query: nextQuery };
      });
    }, 250);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const {
    loading,
    visibleItems,
    hasMore,
    loadMore,
    totalMatching,
    totalEntries,
    mapPins,
    availableYears,
    entryDates,
    bookmarkedDates,
    focusEntryDate,
    revealEntryDate,
    clearFocusEntryDate,
  } = useJournalArchive(filters);

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const root =
      document.querySelector<HTMLElement>("[data-app-scroll]") ?? null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMore();
        }
      },
      { root: root?.clientHeight ? root : null, rootMargin: "240px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, visibleItems.length]);

  // Consume a pending map-jump request once filters allow it, then clear it
  // so it doesn't fire again on the next render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!mapJumpDate) return;
    if (journalArchiveFiltersAreActive(filters)) return;
    revealEntryDate(mapJumpDate);
    setMapJumpDate(null);
  }, [mapJumpDate, filters, revealEntryDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!focusEntryDate) return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-journal-entry-date="${focusEntryDate}"]`
      );
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      clearFocusEntryDate();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusEntryDate, visibleItems, clearFocusEntryDate]);

  const handleWorldMapSelect = (
    selection: JournalArchiveMapClusterSelection
  ) => {
    setSearchInput("");
    if (selection.entryDates.length <= 1) {
      // Single pin: clear filters and scroll to that day in the full feed.
      setFilters(DEFAULT_JOURNAL_ARCHIVE_FILTERS);
      setMapJumpDate(selection.entryDates[0] ?? null);
      return;
    }

    // Cluster: filter the journal list to exactly those location days.
    setMapJumpDate(null);
    setFilters({
      ...DEFAULT_JOURNAL_ARCHIVE_FILTERS,
      mapEntryDates: selection.entryDates,
      mapPlaceLabel: selection.placeLabel,
    });
    scrollAppToTop();
  };

  const filtersActive = journalArchiveFiltersAreActive(filters);

  return (
    <AppPageShell
      title={t("archive.title")}
      subtitle={t("archive.subtitle")}
      titleIcon={<BookOpen className="h-6 w-6" />}
      className="space-y-3"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("archive.searchPlaceholder")}
              className="h-11 rounded-xl pl-9 pr-10"
              aria-label={t("archive.searchPlaceholder")}
            />
            {searchInput ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
                onClick={() => setSearchInput("")}
                title={t("archive.clearSearch")}
                aria-label={t("archive.clearSearch")}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {!loading && totalEntries > 0 ? (
            <JournalArchiveWorldMap
              pins={mapPins}
              onSelectCluster={handleWorldMapSelect}
            />
          ) : null}
        </div>

        {!loading && totalEntries > 0 ? (
          <JournalArchiveSearchFilters
            filters={filters}
            onChange={setFilters}
            availableYears={availableYears}
            entryDates={entryDates}
            bookmarkedDates={bookmarkedDates}
          />
        ) : null}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("archive.loading")}
        </p>
      ) : totalEntries === 0 ? (
        <div className="space-y-2 py-12 text-center">
          <p className="font-crimson text-xl font-semibold">
            {t("archive.empty")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("archive.emptyHelper")}
          </p>
        </div>
      ) : totalMatching === 0 ? (
        <div className="space-y-2 py-12 text-center">
          <p className="font-crimson text-xl font-semibold">
            {t("archive.noResults")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("archive.noResultsHelper")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtersActive ? (
            <p className="text-xs text-muted-foreground">
              {t("archive.resultCount", { count: totalMatching })}
            </p>
          ) : null}

          {visibleItems.map((item) => {
            if (item.kind === "month") {
              return (
                <JournalArchiveBanner
                  key={item.key}
                  variant="month"
                  month={item.month}
                  label={formatArchiveMonthLabel(item.year, item.month)}
                />
              );
            }
            if (item.kind === "holiday") {
              return (
                <JournalArchiveBanner
                  key={item.key}
                  variant="holiday"
                  label={item.name}
                />
              );
            }
            return (
              <JournalArchiveEntry
                key={item.entry.id}
                entry={item.entry}
                highlighted={focusEntryDate === item.entry.entry_date}
              />
            );
          })}

          <div ref={sentinelRef} className="h-8" aria-hidden />

          {hasMore ? (
            <p className="pb-4 text-center text-xs text-muted-foreground">
              {t("archive.loadingMore")}
            </p>
          ) : (
            <p className="pb-4 text-center text-xs text-muted-foreground">
              {t("archive.end")}
            </p>
          )}
        </div>
      )}

      <FloatingBackButton to="/" title={tNav("home")} />
    </AppPageShell>
  );
}
