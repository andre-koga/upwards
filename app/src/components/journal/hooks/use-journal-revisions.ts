import { useCallback, useEffect, useState } from "react";
import type { JournalEntry, JournalEntryRevision } from "@/lib/db/types";
import { journalEntryForDate } from "@/lib/journal/entry-for-date";
import { journalRevisionsForDate } from "@/lib/journal/revisions";

interface State {
  loading: boolean;
  failed: boolean;
  revisions: JournalEntryRevision[];
  current: JournalEntry | null;
}

const INITIAL: State = {
  loading: true,
  failed: false,
  revisions: [],
  current: null,
};

/** One day's earlier versions beside its current entry. `reload` re-reads both. */
export function useJournalRevisions(entryDate: string) {
  const [state, setState] = useState<State>(INITIAL);

  const read = useCallback(async (): Promise<State> => {
    try {
      const [revisions, current] = await Promise.all([
        journalRevisionsForDate(entryDate),
        journalEntryForDate(entryDate),
      ]);
      return { loading: false, failed: false, revisions, current };
    } catch (error) {
      console.error("Error loading journal revisions:", error);
      return { ...INITIAL, loading: false, failed: true };
    }
  }, [entryDate]);

  useEffect(() => {
    let cancelled = false;
    void read().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [read]);

  const reload = useCallback(async () => {
    setState(await read());
  }, [read]);

  return { ...state, reload };
}
