import { useCallback, useEffect, useState } from "react";
import {
  journalRevisionSummaries,
  type RevisionSummary,
} from "@/lib/journal/revisions";

const NONE: ReadonlyMap<string, RevisionSummary> = new Map();

/**
 * Which days have earlier versions, for a list of entries. One read for the
 * whole list, so a long feed does not query once per row. `reload` is for
 * after a restore; `refreshKey` re-reads when the host knows days changed.
 */
export function useJournalRevisionSummaries(refreshKey?: unknown) {
  const [summaries, setSummaries] =
    useState<ReadonlyMap<string, RevisionSummary>>(NONE);

  const reload = useCallback(async () => {
    try {
      setSummaries(await journalRevisionSummaries());
    } catch (error) {
      console.error("Error loading journal revisions:", error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void journalRevisionSummaries()
      .then((next) => {
        if (!cancelled) setSummaries(next);
      })
      .catch((error) =>
        console.error("Error loading journal revisions:", error)
      );
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { summaries, reload };
}
