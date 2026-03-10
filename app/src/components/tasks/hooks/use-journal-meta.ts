import { useState, useCallback } from "react";
import { db } from "@/lib/db";
import { logError } from "@/lib/error-utils";

export function useJournalMeta() {
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
  const [bookmarkedDates, setBookmarkedDates] = useState<Set<string>>(
    new Set()
  );

  const loadJournalMeta = useCallback(async () => {
    try {
      const entries = await db.journalEntries
        .filter((e) => !e.deleted_at)
        .toArray();
      setEntryDates(new Set(entries.map((e) => e.entry_date)));
      setBookmarkedDates(
        new Set(entries.filter((e) => e.is_bookmarked).map((e) => e.entry_date))
      );
    } catch (err) {
      logError("Error loading journal meta", err);
    }
  }, []);

  return { entryDates, bookmarkedDates, loadJournalMeta };
}
