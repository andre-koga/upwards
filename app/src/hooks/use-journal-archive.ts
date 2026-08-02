import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";
import {
  JOURNAL_ARCHIVE_PAGE_SIZE,
  buildJournalArchiveFeed,
  collectJournalArchiveMapPins,
  collectJournalArchiveYears,
  journalArchiveFiltersKey,
  journalEntryHasContent,
  journalEntryMatchesFilters,
  type JournalArchiveFilters,
  type JournalArchiveItem,
  type JournalArchiveMapPin,
} from "@/lib/journal/archive";
import type { LocaleValue } from "@/lib/i18n/locale-storage";
import { logError } from "@/lib/error-utils";

export function useJournalArchive(filters: JournalArchiveFilters) {
  const { i18n } = useTranslation();
  const locale = (i18n.language as LocaleValue) || "en";

  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [focusEntryDate, setFocusEntryDate] = useState<string | null>(null);
  const filterKey = `${locale}\0${journalArchiveFiltersKey(filters)}`;
  const [activeFilterKey, setActiveFilterKey] = useState(filterKey);

  if (activeFilterKey !== filterKey) {
    setActiveFilterKey(filterKey);
    setPage(1);
  }

  const loadEntries = useCallback(async () => {
    try {
      const rows = await db.journalEntries
        .filter((e) => journalEntryHasContent(e))
        .toArray();
      setAllEntries(rows);
    } catch (err) {
      logError("Error loading journal archive", err);
      setAllEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- loading IndexedDB journal entries into local state */
    void loadEntries();
  }, [loadEntries]);

  const filteredEntries = useMemo(() => {
    return allEntries.filter((e) =>
      journalEntryMatchesFilters(e, filters, locale)
    );
  }, [allEntries, filters, locale]);

  const fullFeed = useMemo(
    () => buildJournalArchiveFeed(filteredEntries, locale),
    [filteredEntries, locale]
  );

  const mapPins: JournalArchiveMapPin[] = useMemo(
    () => collectJournalArchiveMapPins(allEntries),
    [allEntries]
  );

  const availableYears = useMemo(
    () => collectJournalArchiveYears(allEntries),
    [allEntries]
  );

  const entryDates = useMemo(() => {
    const dates = new Set<string>();
    for (const entry of allEntries) {
      dates.add(entry.entry_date);
    }
    return dates;
  }, [allEntries]);

  const bookmarkedDates = useMemo(() => {
    const dates = new Set<string>();
    for (const entry of allEntries) {
      if (entry.is_bookmarked) dates.add(entry.entry_date);
    }
    return dates;
  }, [allEntries]);

  const visibleCount = page * JOURNAL_ARCHIVE_PAGE_SIZE;

  const { visibleItems, hasMore } = useMemo(() => {
    let entryCount = 0;
    const items: JournalArchiveItem[] = [];
    for (const item of fullFeed) {
      if (item.kind === "entry") {
        if (entryCount >= visibleCount) break;
        entryCount += 1;
      } else if (entryCount >= visibleCount) {
        break;
      }
      items.push(item);
    }
    while (items.length > 0 && items[items.length - 1]?.kind !== "entry") {
      items.pop();
    }
    const totalEntries = filteredEntries.length;
    return {
      visibleItems: items,
      hasMore: entryCount < totalEntries,
    };
  }, [fullFeed, visibleCount, filteredEntries.length]);

  const loadMore = useCallback(() => {
    setPage((n) => n + 1);
  }, []);

  const revealEntryDate = useCallback(
    (entryDate: string) => {
      const dates = [...allEntries]
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
        .map((entry) => entry.entry_date);
      const index = dates.indexOf(entryDate);
      if (index >= 0) {
        const neededPage = Math.floor(index / JOURNAL_ARCHIVE_PAGE_SIZE) + 1;
        setPage((current) => Math.max(current, neededPage));
      }
      setFocusEntryDate(entryDate);
    },
    [allEntries]
  );

  const clearFocusEntryDate = useCallback(() => {
    setFocusEntryDate(null);
  }, []);

  return {
    loading,
    visibleItems,
    hasMore,
    loadMore,
    totalMatching: filteredEntries.length,
    totalEntries: allEntries.length,
    mapPins,
    availableYears,
    entryDates,
    bookmarkedDates,
    focusEntryDate,
    revealEntryDate,
    clearFocusEntryDate,
    reload: loadEntries,
  };
}
