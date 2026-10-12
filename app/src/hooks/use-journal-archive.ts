import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/lib/db";
import type { JournalEntry, Memory } from "@/lib/db/types";
import {
  JOURNAL_ARCHIVE_PAGE_SIZE,
  buildJournalArchiveFeed,
  collectJournalArchiveMapPins,
  collectJournalArchiveYears,
  isArchiveRecord,
  journalArchiveFiltersKey,
  journalEntryHasContent,
  journalEntryMatchesFilters,
  type JournalArchiveFilters,
  type JournalArchiveItem,
  type JournalArchiveMapPin,
} from "@/lib/journal/archive";
import {
  collectMemoryYears,
  memoryMatchesFilters,
  recordMemories,
} from "@/lib/journal/record";
import type { LocaleValue } from "@/lib/i18n/locale-storage";
import { logError } from "@/lib/error-utils";
import {
  useBirthday,
  useHolidayCalendars,
} from "@/lib/holidays/use-holiday-calendars";

export function useJournalArchive(filters: JournalArchiveFilters) {
  const { i18n } = useTranslation();
  const locale = (i18n.language as LocaleValue) || "en";
  const calendars = useHolidayCalendars();
  const birthday = useBirthday();

  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [allMemories, setAllMemories] = useState<Memory[]>([]);
  const [trashedMemories, setTrashedMemories] = useState<Memory[]>([]);
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
      const [rows, memoryRows] = await Promise.all([
        db.journalEntries.filter((e) => journalEntryHasContent(e)).toArray(),
        db.memories.toArray(),
      ]);
      setAllEntries(rows);
      setAllMemories(recordMemories(memoryRows));
      setTrashedMemories(memoryRows.filter((m) => Boolean(m.deleted_at)));
    } catch (err) {
      logError("Error loading journal archive", err);
      setAllEntries([]);
      setAllMemories([]);
      setTrashedMemories([]);
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
      journalEntryMatchesFilters(e, filters, locale, calendars, birthday)
    );
  }, [allEntries, filters, locale, calendars, birthday]);

  const filteredMemories = useMemo(
    () => allMemories.filter((m) => memoryMatchesFilters(m, filters)),
    [allMemories, filters]
  );

  const fullFeed = useMemo(
    () =>
      buildJournalArchiveFeed(
        filteredEntries,
        locale,
        calendars,
        birthday,
        filteredMemories
      ),
    [filteredEntries, filteredMemories, locale, calendars, birthday]
  );

  const mapPins: JournalArchiveMapPin[] = useMemo(
    () => collectJournalArchiveMapPins(allEntries),
    [allEntries]
  );

  const availableYears = useMemo(() => {
    const years = new Set([
      ...collectJournalArchiveYears(allEntries),
      ...collectMemoryYears(allMemories),
    ]);
    return [...years].sort((a, b) => b - a);
  }, [allEntries, allMemories]);

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
  const totalMatching = filteredEntries.length + filteredMemories.length;

  const { visibleItems, hasMore } = useMemo(() => {
    let recordCount = 0;
    const items: JournalArchiveItem[] = [];
    for (const item of fullFeed) {
      if (isArchiveRecord(item)) {
        if (recordCount >= visibleCount) break;
        recordCount += 1;
      } else if (recordCount >= visibleCount) {
        break;
      }
      items.push(item);
    }
    while (items.length > 0 && !isArchiveRecord(items[items.length - 1])) {
      items.pop();
    }
    return {
      visibleItems: items,
      hasMore: recordCount < totalMatching,
    };
  }, [fullFeed, visibleCount, totalMatching]);

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
    totalMatching,
    totalEntries: allEntries.length + allMemories.length,
    trashedMemories,
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
