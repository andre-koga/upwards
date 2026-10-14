import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  Images,
  List,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useJournalArchive } from "@/hooks/use-journal-archive";
import { useMediaQuery } from "@/hooks/use-media-query";
import JournalArchiveEntry from "@/components/journal/journal-archive-entry";
import JournalArchiveBanner from "@/components/journal/journal-archive-banner";
import JournalVersionsDialog from "@/components/journal/journal-versions-dialog";
import { useJournalRevisionSummaries } from "@/hooks/use-journal-revision-summaries";
import JournalArchiveMemory from "@/components/journal/journal-archive-memory";
import { DeletedMemoriesDialog } from "@/components/memories/deleted-memories-dialog";
import { MemoryEditDialog } from "@/components/memories/memory-edit-dialog";
import type { JournalEntry, Memory } from "@/lib/db/types";
import {
  blankMemory,
  saveMemoryValues,
  trashMemory,
  type MemoryValues,
} from "@/lib/memories-actions";
import JournalArchiveMapView, {
  type JournalArchiveMapClusterSelection,
} from "@/components/journal/journal-archive-world-map";
import JournalReader from "@/components/journal/journal-reader";
import JournalArchiveCalendar from "@/components/journal/journal-archive-calendar";
import JournalArchiveGallery from "@/components/journal/journal-archive-gallery";
import {
  DEFAULT_JOURNAL_VIEW,
  parseJournalView,
  type JournalView,
} from "@/lib/journal/view-modes";
import JournalArchiveSearchFilters from "@/components/journal/journal-archive-search-filters";
import {
  DEFAULT_JOURNAL_ARCHIVE_FILTERS,
  formatArchiveMonthLabel,
  journalArchiveFiltersAreActive,
  type JournalArchiveFilters,
} from "@/lib/journal/archive";
import { memoriesByDate, memoryRememberedDate } from "@/lib/journal/record";
import { useAccountSettings } from "@/lib/use-account-settings";
import { useHemisphere } from "@/lib/holidays/use-holiday-calendars";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";
import { cn } from "@/lib/utils";

export default function JournalPage() {
  const { t } = useTranslation("journal");
  const { t: tNav } = useTranslation("nav");
  const clipEnabled = useAccountSettings().dailyClip === true;
  const hemisphere = useHemisphere();
  const [chosenFilters, setFilters] = useState<JournalArchiveFilters>(
    DEFAULT_JOURNAL_ARCHIVE_FILTERS
  );
  // The video chip disappears when the daily clip is off, so a "has video"
  // filter chosen earlier must not keep hiding entries with no way to clear it.
  const filters = useMemo<JournalArchiveFilters>(
    () =>
      clipEnabled || chosenFilters.hasVideo === "any"
        ? chosenFilters
        : { ...chosenFilters, hasVideo: "any" },
    [clipEnabled, chosenFilters]
  );
  const [searchInput, setSearchInput] = useState("");
  const [mapJumpDate, setMapJumpDate] = useState<string | null>(null);
  const [jumpMemoryId, setJumpMemoryId] = useState<string | null>(null);
  // The day being read: in the rail at `lg`, under the calendar below it.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const isWide = useMediaQuery("(min-width: 1024px)");
  // The view lives in the address, so Back, a reload and a shared link all
  // land on the same view of the record.
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseJournalView(searchParams.get("view"));
  const setView = (next: JournalView) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === DEFAULT_JOURNAL_VIEW) params.delete("view");
        else params.set("view", next);
        return params;
      },
      { replace: true }
    );
  const focusDateParam = searchParams.get("focus");
  const focusMemoryParam = searchParams.get("memory");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // `undefined` is closed; a memory is open for editing; `isNew` marks a blank.
  const [editingMemory, setEditingMemory] = useState<
    { memory: Memory; isNew: boolean } | undefined
  >(undefined);
  const [deletedOpen, setDeletedOpen] = useState(false);
  // The day whose earlier versions are open, if any.
  const [versionsDate, setVersionsDate] = useState<string | null>(null);
  const { summaries: revisionSummaries, reload: reloadRevisions } =
    useJournalRevisionSummaries();

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
    matchingEntries,
    matchingMemories,
    focusEntryDate,
    revealEntryDate,
    clearFocusEntryDate,
    focusMemoryId,
    revealMemory,
    clearFocusMemoryId,
    trashedMemories,
    reload,
  } = useJournalArchive(filters);

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (view !== "feed" || !node || !hasMore) return;

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
  }, [view, hasMore, loadMore, visibleItems.length]);

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

  // The command palette sends people here with `?focus=<date>` or
  // `?memory=<id>`. Show the whole record, then let the jump effects above and
  // below find the card; the address is cleaned up so a reload does not jump
  // again.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (loading || (!focusDateParam && !focusMemoryParam)) return;
    setSearchInput("");
    setFilters(DEFAULT_JOURNAL_ARCHIVE_FILTERS);
    setMapJumpDate(focusDateParam);
    setJumpMemoryId(focusMemoryParam);
    if (focusDateParam) setSelectedDate(focusDateParam);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("focus");
        params.delete("memory");
        params.delete("view");
        return params;
      },
      { replace: true }
    );
  }, [loading, focusDateParam, focusMemoryParam, setSearchParams]);

  useEffect(() => {
    if (!jumpMemoryId) return;
    if (journalArchiveFiltersAreActive(filters)) return;
    revealMemory(jumpMemoryId);
    const jumped = matchingMemories.find((m) => m.id === jumpMemoryId);
    if (jumped) setSelectedDate(memoryRememberedDate(jumped));
    setJumpMemoryId(null);
  }, [jumpMemoryId, filters, revealMemory, matchingMemories]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!focusMemoryId) return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-journal-memory-id="${focusMemoryId}"]`
      );
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      clearFocusMemoryId();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusMemoryId, visibleItems, clearFocusMemoryId]);

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
    // Both outcomes read the days in the feed.
    setView("feed");
    if (selection.entryDates.length <= 1) {
      // Single pin: clear filters and scroll to that day in the full feed.
      setFilters(DEFAULT_JOURNAL_ARCHIVE_FILTERS);
      setMapJumpDate(selection.entryDates[0] ?? null);
      if (selection.entryDates[0]) setSelectedDate(selection.entryDates[0]);
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

  const saveMemory = async (values: MemoryValues) => {
    if (!editingMemory) return;
    await saveMemoryValues(editingMemory.memory, values);
    await reload();
  };
  const trashOneMemory = async (memory: Memory) => {
    await trashMemory(memory);
    await reload();
  };

  // The rail beside the list: the Feed and the Calendar read a day there. The
  // Map and the Gallery use the whole width instead.
  const showRail =
    isWide &&
    !loading &&
    totalEntries > 0 &&
    (view === "feed" || view === "calendar");
  // The newest record in the feed, a day or a memory, is the day opened first.
  const firstRecordDate = (() => {
    for (const item of visibleItems) {
      if (item.kind === "entry") return item.entry.entry_date;
      if (item.kind === "memory") return item.date;
    }
    return null;
  })();
  const memoriesOnDate = memoriesByDate(matchingMemories);
  const pickedInView =
    selectedDate !== null &&
    (matchingEntries.some((entry) => entry.entry_date === selectedDate) ||
      memoriesOnDate.has(selectedDate));
  // The Feed always has something open: the day picked, else the newest. The
  // Calendar keeps an empty day so it can say so.
  const readerDate =
    pickedInView || (view === "calendar" && selectedDate)
      ? selectedDate
      : view === "feed"
        ? firstRecordDate
        : null;
  const readerEntry = readerDate
    ? (matchingEntries.find((entry) => entry.entry_date === readerDate) ?? null)
    : null;
  const readerMemories = readerDate
    ? (memoriesOnDate.get(readerDate) ?? [])
    : [];

  const renderEntry = (entry: JournalEntry) => (
    <JournalArchiveEntry
      key={entry.id}
      entry={entry}
      highlighted={focusEntryDate === entry.entry_date}
      revisions={revisionSummaries.get(entry.entry_date)}
      onOpenVersions={setVersionsDate}
      onSelect={showRail ? setSelectedDate : undefined}
      selected={showRail && readerDate === entry.entry_date}
      compact={showRail}
    />
  );

  // A memory stands on the day it was remembered, so it appears in the Feed,
  // the Calendar and the reader. It has no place, so the Map leaves it out.
  const renderMemory = (memory: Memory, showDate: boolean) => (
    <JournalArchiveMemory
      key={memory.id}
      memory={memory}
      showDate={showDate}
      onEdit={(m) => setEditingMemory({ memory: m, isNew: false })}
      onTrash={(m) => void trashOneMemory(m)}
    />
  );

  const showMemoryInFeed = (memoryId: string) => {
    setSearchInput("");
    setFilters(DEFAULT_JOURNAL_ARCHIVE_FILTERS);
    setJumpMemoryId(memoryId);
    setView("feed");
  };

  return (
    <AppPageShell
      title={t("archive.title")}
      subtitle={t("archive.subtitle")}
      titleIcon={<BookOpen className="h-6 w-6" />}
      className="space-y-3"
    >
      <div
        className={cn(
          showRail &&
            "lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-x-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-x-8"
        )}
      >
        <div className="min-w-0 space-y-3">
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

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                onClick={() =>
                  setEditingMemory({ memory: blankMemory(), isNew: true })
                }
                title={t("archive.memory.add")}
                aria-label={t("archive.memory.add")}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
              {trashedMemories.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl text-muted-foreground"
                  onClick={() => setDeletedOpen(true)}
                  title={t("archive.memory.deleted", {
                    count: trashedMemories.length,
                  })}
                  aria-label={t("archive.memory.deleted", {
                    count: trashedMemories.length,
                  })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
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
          ) : (
            <Tabs
              value={view}
              onValueChange={(next) => setView(parseJournalView(next))}
            >
              <TabsList aria-label={t("archive.views.label")}>
                <TabsTrigger value="feed">
                  <List aria-hidden />
                  {t("archive.views.feed")}
                </TabsTrigger>
                <TabsTrigger value="calendar">
                  <CalendarDays aria-hidden />
                  {t("archive.views.calendar")}
                </TabsTrigger>
                <TabsTrigger value="map">
                  <MapPin aria-hidden />
                  {t("archive.views.map")}
                </TabsTrigger>
                <TabsTrigger value="gallery">
                  <Images aria-hidden />
                  {t("archive.views.gallery")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="feed">
                {totalMatching === 0 ? (
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
                            hemisphere={hemisphere}
                            label={formatArchiveMonthLabel(
                              item.year,
                              item.month
                            )}
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
                      if (item.kind === "memory") {
                        return renderMemory(item.memory, true);
                      }
                      return renderEntry(item.entry);
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
              </TabsContent>

              <TabsContent value="calendar">
                <JournalArchiveCalendar
                  entries={matchingEntries}
                  memories={matchingMemories}
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  renderEntry={renderEntry}
                  renderMemory={(memory) => renderMemory(memory, false)}
                  showDetail={!showRail}
                />
              </TabsContent>

              <TabsContent value="map">
                <JournalArchiveMapView
                  pins={mapPins}
                  onSelectCluster={handleWorldMapSelect}
                />
              </TabsContent>

              <TabsContent value="gallery">
                <JournalArchiveGallery
                  entries={matchingEntries}
                  memories={matchingMemories}
                  includeVideo={clipEnabled}
                  onShowMemory={showMemoryInFeed}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>

        {showRail ? (
          <aside
            aria-label={t("reader.rail")}
            className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
          >
            <JournalReader
              date={readerDate}
              entry={readerEntry}
              memories={readerMemories}
              renderMemory={(memory) => renderMemory(memory, false)}
              revisions={
                readerDate ? revisionSummaries.get(readerDate) : undefined
              }
              onOpenVersions={setVersionsDate}
            />
          </aside>
        ) : null}
      </div>

      <MemoryEditDialog
        open={editingMemory !== undefined}
        memory={editingMemory?.memory ?? null}
        isNew={editingMemory?.isNew ?? false}
        onOpenChange={(open) => !open && setEditingMemory(undefined)}
        onSave={saveMemory}
      />
      <DeletedMemoriesDialog
        open={deletedOpen}
        onOpenChange={setDeletedOpen}
        memories={trashedMemories}
        onChanged={() => void reload()}
      />
      {versionsDate ? (
        <JournalVersionsDialog
          open
          onOpenChange={(open) => !open && setVersionsDate(null)}
          entryDate={versionsDate}
          onRestored={() => {
            void reload();
            void reloadRevisions();
          }}
        />
      ) : null}

      <FloatingBackButton to="/" title={tNav("home")} />
    </AppPageShell>
  );
}
