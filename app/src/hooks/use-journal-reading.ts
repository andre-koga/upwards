import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  JournalReadingError,
  type JournalReadingErrorCode,
} from "@/lib/ai/journal-reading-client";
import { getAiSettingsStatus } from "@/lib/ai/settings-client";
import { logError } from "@/lib/error-utils";
import {
  collectReadingDays,
  readJournal,
} from "@/lib/personality/journal-reading";
import type { BehaviourRange } from "@/lib/personality/behaviour";
import type { SentDay } from "@/lib/personality/quotes";

/** Whether an AI is set up in Settings. `unknown` until asked, or when offline. */
export type AiConnection =
  | { state: "unknown" }
  | { state: "not_connected" }
  | { state: "connected"; model: string | null };

export type ReadingStatus = "idle" | "reading" | "error";

/**
 * Drives the journal reading from the You page. `prepare` collects the days
 * that would be sent and holds them as `pending`; the person confirms, and
 * `send` sends exactly those days, so what they agreed to is what leaves.
 */
export function useJournalReading(onSaved: () => void, range: BehaviourRange) {
  const { i18n } = useTranslation();
  const [ai, setAi] = useState<AiConnection>({ state: "unknown" });
  const [pending, setPending] = useState<SentDay[] | null>(null);
  const [status, setStatus] = useState<ReadingStatus>("idle");
  const [errorCode, setErrorCode] = useState<JournalReadingErrorCode | null>(
    null
  );
  const [writtenDays, setWrittenDays] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAiSettingsStatus()
      .then((result) => {
        if (cancelled) return;
        setAi(
          result.configured
            ? { state: "connected", model: result.model }
            : { state: "not_connected" }
        );
      })
      .catch(() => {
        // Offline or signed out: leave the connection unknown rather than
        // claiming it is missing.
      });
    collectReadingDays(range)
      .then((days) => {
        if (!cancelled) setWrittenDays(days.length);
      })
      .catch((err) => logError("Counting journal days to read", err));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const prepare = useCallback(async () => {
    setErrorCode(null);
    setStatus("idle");
    const days = await collectReadingDays(range);
    setWrittenDays(days.length);
    setPending(days.length > 0 ? days : null);
  }, [range]);

  const cancel = useCallback(() => setPending(null), []);

  const send = useCallback(async () => {
    if (!pending) return;
    const days = pending;
    setPending(null);
    setStatus("reading");
    setErrorCode(null);
    try {
      await readJournal(days, i18n.language === "pt" ? "pt" : "en");
      setStatus("idle");
      onSaved();
    } catch (err) {
      const code = err instanceof JournalReadingError ? err.code : "generic";
      if (code === "generic") logError("Reading the journal", err);
      setErrorCode(code);
      setStatus("error");
    }
  }, [pending, i18n.language, onSaved]);

  return { ai, writtenDays, pending, status, errorCode, prepare, cancel, send };
}
