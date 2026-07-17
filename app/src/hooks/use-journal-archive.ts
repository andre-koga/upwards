import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";
import {
  JOURNAL_ARCHIVE_PAGE_SIZE,
  buildJournalArchiveFeed,
  journalEntryHasContent,
  journalEntryMatchesQuery,
  type JournalArchiveItem,
} from "@/lib/journal/archive";
import type { LocaleValue } from "@/lib/i18n/locale-storage";
import { logError } from "@/lib/error-utils";

export function useJournalArchive(searchQuery: string) {
  const { i18n } = useTranslation();
  const locale = (i18n.language as LocaleValue) || "en";

  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const filterKey = `${locale}\0${searchQuery}`;
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
      journalEntryMatchesQuery(e, searchQuery, locale)
    );
  }, [allEntries, searchQuery, locale]);

  const fullFeed = useMemo(
    () => buildJournalArchiveFeed(filteredEntries, locale),
    [filteredEntries, locale]
  );

  const visibleCount = page * JOURNAL_ARCHIVE_PAGE_SIZE;

  const { visibleItems, hasMore } = useMemo(() => {
    let entryCount = 0;
    const items: JournalArchiveItem[] = [];
    for (const item of fullFeed) {
      if (item.kind === "entry") {
        if (entryCount >= visibleCount) break;
        entryCount += 1;
      }
      if (item.kind === "month") {
        const remainingEntries = visibleCount - entryCount;
        if (remainingEntries <= 0) break;
      }
      items.push(item);
    }
    while (items.length > 0 && items[items.length - 1]?.kind === "month") {
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

  return {
    loading,
    visibleItems,
    hasMore,
    loadMore,
    totalMatching: filteredEntries.length,
    totalEntries: allEntries.length,
    reload: loadEntries,
  };
}
