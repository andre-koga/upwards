import { supabase } from "@/lib/supabase";
import type { ParsedReading } from "../../../../supabase/functions/_shared/journal-personality";
import type { SentDay } from "@/lib/personality/quotes";

export type { ParsedReading };

export type JournalReadingErrorCode =
  | "not_configured"
  | "rate_limited"
  | "provider_rejected"
  | "provider_empty"
  | "provider_unreachable"
  | "provider_invalid"
  | "generic";

const KNOWN_CODES: readonly JournalReadingErrorCode[] = [
  "not_configured",
  "rate_limited",
  "provider_rejected",
  "provider_empty",
  "provider_unreachable",
  "provider_invalid",
];

/** A failed reading. `code` maps to a line in `personality:journal.errors`. */
export class JournalReadingError extends Error {
  readonly code: JournalReadingErrorCode;

  constructor(code: JournalReadingErrorCode, message?: string) {
    super(message ?? code);
    this.name = "JournalReadingError";
    this.code = code;
  }
}

export function readingErrorCode(value: unknown): JournalReadingErrorCode {
  return typeof value === "string" &&
    (KNOWN_CODES as readonly string[]).includes(value)
    ? (value as JournalReadingErrorCode)
    : "generic";
}

/** The `code` in an edge function's error body, if the response carries one. */
async function codeFromError(error: unknown): Promise<JournalReadingErrorCode> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = (await (context as Response).clone().json()) as {
        code?: unknown;
      };
      return readingErrorCode(body?.code);
    } catch {
      return "generic";
    }
  }
  return "generic";
}

/**
 * Asks the read-journal-personality edge function to score `days` with the
 * user's own model. Only the words of these days are sent.
 */
export async function requestJournalReading(
  days: readonly SentDay[],
  locale: "en" | "pt"
): Promise<ParsedReading> {
  if (!supabase) throw new JournalReadingError("generic");
  const { data, error } = await supabase.functions.invoke(
    "read-journal-personality",
    { body: { locale, days } }
  );
  if (error) throw new JournalReadingError(await codeFromError(error));
  const reading = (data as { reading?: ParsedReading } | null)?.reading;
  if (!reading) throw new JournalReadingError("provider_invalid");
  return reading;
}
