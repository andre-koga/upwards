import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, History } from "lucide-react";
import type { PaletteCommand } from "@/components/layout/command-palette";
import {
  RECORD_SEARCH_MIN_LENGTH,
  searchRecord,
  type RecordHit,
  type RecordSearchContext,
} from "@/lib/journal/record-search";
import type { LocaleValue } from "@/lib/i18n/locale-storage";
import {
  useBirthday,
  useHolidayCalendars,
} from "@/lib/holidays/use-holiday-calendars";

/** Pause after typing before the record is searched, so each keystroke is cheap. */
const SEARCH_DELAY_MS = 120;

const NONE: PaletteCommand[] = [];

/**
 * Days and memories that match what is typed in the palette, as commands that
 * open them in the Journal. The record lives on this device, so the search is
 * a local read; nothing waits on the network.
 */
export function useRecordCommands(query: string): {
  commands: PaletteCommand[];
  /** True from the first keystroke until the search for this text has answered. */
  searching: boolean;
} {
  const { t, i18n } = useTranslation("journal");
  const navigate = useNavigate();
  const calendars = useHolidayCalendars();
  const birthday = useBirthday();
  const [result, setResult] = useState<{
    query: string;
    hits: RecordHit[];
  } | null>(null);

  const trimmed = query.trim();
  const locale = (i18n.language as LocaleValue) || "en";
  const untitled = t("untitled");
  const untitledMemory = t("archive.memory.untitled");

  useEffect(() => {
    if (trimmed.length < RECORD_SEARCH_MIN_LENGTH) return;
    let cancelled = false;
    const context: RecordSearchContext = {
      locale,
      calendars,
      birthday,
      untitled,
      untitledMemory,
    };
    const timer = window.setTimeout(() => {
      searchRecord(trimmed, context)
        .then((hits) => {
          if (!cancelled) setResult({ query: trimmed, hits });
        })
        .catch((error) => {
          console.error("Error searching the journal:", error);
          if (!cancelled) setResult({ query: trimmed, hits: [] });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed, locale, calendars, birthday, untitled, untitledMemory]);

  // Results for an older query are not shown against a newer one.
  const hits = result?.query === trimmed ? result.hits : null;
  const searching = trimmed.length >= RECORD_SEARCH_MIN_LENGTH && hits === null;

  const commands = useMemo<PaletteCommand[]>(() => {
    if (!hits) return NONE;
    return hits.map((hit) => ({
      id: `record-${hit.kind}-${hit.id}`,
      group: "record",
      label: hit.emoji ? `${hit.emoji} ${hit.title}` : hit.title,
      detail: hit.detail || undefined,
      icon: hit.kind === "entry" ? BookOpen : History,
      run: () =>
        navigate(
          hit.kind === "entry"
            ? `/journal?focus=${encodeURIComponent(hit.id)}`
            : `/journal?memory=${encodeURIComponent(hit.id)}`
        ),
    }));
  }, [hits, navigate]);

  return { commands, searching };
}
