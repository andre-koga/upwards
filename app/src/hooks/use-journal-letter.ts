import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getAccountSettings } from "@/lib/account-settings";
import { useAccountSettings } from "@/lib/use-account-settings";
import { getAiSettingsStatus } from "@/lib/ai/settings-client";
import { buildLetterRequest } from "@/lib/ai/build-letter-payload";
import {
  getCachedLetter,
  setCachedLetter,
  type CachedLetter,
} from "@/lib/ai/letter-cache";
import {
  InsightRequestError,
  describeInsightError,
  readInsightErrorBody,
  type InsightErrorBody,
} from "@/lib/ai/insight-errors";
import {
  fingerprintLetter,
  letterHasProse,
  type LetterExperiment,
  type LetterParagraph,
} from "../../../supabase/functions/_shared/letter";

export type LetterPhase =
  | "off"
  | "loading"
  | "quiet"
  | "ready"
  | "offline"
  | "not-configured"
  | "error";

export interface JournalLetterState {
  phase: LetterPhase;
  letter: CachedLetter | null;
  stale: boolean;
  refreshing: boolean;
  notice: string | null;
  refresh: () => void;
  dismissExperiment: () => void;
}

function letterErrorMessage(
  body: InsightErrorBody | null,
  fallback: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (body?.code === "reading_off") return t("letter.readingOff");
  return describeInsightError(body, fallback, t);
}

function languageOf(code: string): "en" | "pt" {
  return code.toLowerCase().startsWith("pt") ? "pt" : "en";
}

function readAnswer(data: unknown): {
  paragraphs: LetterParagraph[];
  experiment: LetterExperiment | null;
  quiet: boolean;
} | null {
  const row = data as {
    paragraphs?: unknown;
    experiment?: unknown;
    quiet?: unknown;
  } | null;
  if (!row || typeof row !== "object" || !Array.isArray(row.paragraphs)) {
    return null;
  }
  const experiment =
    row.experiment &&
    typeof row.experiment === "object" &&
    typeof (row.experiment as LetterExperiment).text === "string"
      ? (row.experiment as LetterExperiment)
      : null;
  return {
    paragraphs: row.paragraphs as LetterParagraph[],
    experiment,
    quiet: row.quiet === true || (row.paragraphs.length === 0 && !experiment),
  };
}

/**
 * The weekly letter. Reading off means this never builds a request and never
 * calls the function, so the journal stays on the device.
 */
export function useJournalLetter(): JournalLetterState {
  const { t, i18n } = useTranslation("home");
  const readingOn = useAccountSettings().journalReading === true;
  const { isAuthed } = useAuth();
  const isOnline = useOnlineStatus();
  const [phase, setPhase] = useState<LetterPhase>(
    readingOn ? "loading" : "off"
  );
  const [letter, setLetter] = useState<CachedLetter | null>(null);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const latest = useRef(0);

  const load = useCallback(
    async (force: boolean) => {
      const run = ++latest.current;
      const current = () => run === latest.current;
      // Off is checked before any read of the journal. A cached letter from a
      // previous yes is not shown again until reading is on.
      if (getAccountSettings().journalReading !== true) {
        setPhase("off");
        setLetter(null);
        setNotice(null);
        return;
      }

      const cached = getCachedLetter();
      if (!isSupabaseConfigured || !isOnline) {
        setLetter(cached);
        setStale(Boolean(cached));
        setNotice(t("letter.offline"));
        setPhase(cached ? (cached.quiet ? "quiet" : "ready") : "offline");
        return;
      }
      if (!isAuthed) {
        setPhase("loading");
        return;
      }

      try {
        const { request, habits } = await buildLetterRequest(
          languageOf(i18n.language)
        );
        if (!current()) return;
        const fingerprint = fingerprintLetter(request);
        if (!letterHasProse(request)) {
          const quiet: CachedLetter = {
            generatedAt: new Date().toISOString(),
            fingerprint,
            paragraphs: [],
            experiment: null,
            habits,
            quiet: true,
            sent: false,
            experimentDismissed: false,
          };
          setCachedLetter(quiet);
          setLetter(quiet);
          setStale(false);
          setNotice(null);
          setPhase("quiet");
          return;
        }

        const fresh = !force && cached?.fingerprint === fingerprint;
        if (cached) {
          setLetter(cached);
          setStale(cached.fingerprint !== fingerprint);
          setPhase(cached.quiet ? "quiet" : "ready");
        } else {
          setPhase("loading");
        }

        const status = await getAiSettingsStatus();
        if (!current()) return;
        if (!status.configured) {
          setPhase("not-configured");
          return;
        }
        if (fresh) return;

        setRefreshing(true);
        setNotice(null);
        if (!supabase) throw new InsightRequestError(t("error.offline"), null);
        const { data, error } = await supabase.functions.invoke(
          "generate-journal-letter",
          { body: { ...request, force } }
        );
        if (error) {
          const body = await readInsightErrorBody(error);
          throw new InsightRequestError(
            letterErrorMessage(body, error.message, t),
            body?.code ?? null
          );
        }
        if (typeof data?.error === "string") {
          throw new InsightRequestError(
            letterErrorMessage(data as InsightErrorBody, data.error, t),
            typeof data.code === "string" ? data.code : null
          );
        }
        const answer = readAnswer(data);
        if (!answer) {
          throw new InsightRequestError(
            t("error.providerInvalid"),
            "provider_invalid"
          );
        }
        const next: CachedLetter = {
          generatedAt: new Date().toISOString(),
          fingerprint,
          paragraphs: answer.paragraphs,
          experiment: answer.experiment,
          habits,
          quiet: answer.quiet,
          sent: true,
          experimentDismissed: false,
        };
        setCachedLetter(next);
        if (!current()) return;
        setLetter(next);
        setStale(false);
        setNotice(null);
        setPhase(next.quiet ? "quiet" : "ready");
      } catch (error) {
        if (!current()) return;
        const message = error instanceof Error ? error.message : "";
        setNotice(message);
        setPhase((prev) =>
          prev === "ready" || prev === "quiet" ? prev : "error"
        );
      } finally {
        if (current()) setRefreshing(false);
      }
    },
    [i18n.language, isAuthed, isOnline, t]
  );

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- loads the letter when reading turns on */
    void load(false);
  }, [load, readingOn]);

  const refresh = useCallback(() => void load(true), [load]);

  const dismissExperiment = useCallback(() => {
    const cached = getCachedLetter();
    if (!cached) return;
    const next = { ...cached, experimentDismissed: true };
    setCachedLetter(next);
    setLetter(next);
  }, []);

  return {
    phase: readingOn ? phase : "off",
    letter: readingOn ? letter : null,
    stale,
    refreshing,
    notice,
    refresh,
    dismissExperiment,
  };
}
