import { useState, useCallback } from "react";
import { db } from "@/lib/db";
import { logError } from "@/lib/error-utils";

export function useJournalMeta() {
  const [bookmarkedDates, setBookmarkedDates] = useState<Set<string>>(
    new Set()
  );
  const [entryEmojiByDate, setEntryEmojiByDate] = useState<
    Record<string, string>
  >({});

  const loadJournalMeta = useCallback(async () => {
    try {
      const entries = await db.journalEntries
        .filter((e) => !e.deleted_at)
        .toArray();
      setBookmarkedDates(
        new Set(entries.filter((e) => e.is_bookmarked).map((e) => e.entry_date))
      );
      const emojis: Record<string, string> = {};
      for (const e of entries) {
        const em = e.day_emoji?.trim();
        if (em) emojis[e.entry_date] = em;
      }
      setEntryEmojiByDate(emojis);
    } catch (err) {
      logError("Error loading journal meta", err);
    }
  }, []);

  return { bookmarkedDates, entryEmojiByDate, loadJournalMeta };
}
