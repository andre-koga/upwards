import type {
  LetterExperiment,
  LetterParagraph,
} from "../../../../supabase/functions/_shared/letter";
import type { LetterRequestHabit } from "./build-letter-payload";

const CACHE_KEY = "upwards:journal_letter";

export interface CachedLetter {
  generatedAt: string;
  fingerprint: string;
  paragraphs: LetterParagraph[];
  experiment: LetterExperiment | null;
  /** Kept on this device so a habit key can become an id. Never sent. */
  habits: LetterRequestHabit[];
  quiet: boolean;
  /** True when this letter was answered by the model. A quiet local week is false. */
  sent: boolean;
  experimentDismissed: boolean;
}

function isParagraph(value: unknown): value is LetterParagraph {
  const row = value as Partial<LetterParagraph> | null;
  return !!row && typeof row.text === "string" && Array.isArray(row.quotes);
}

export function getCachedLetter(): CachedLetter | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLetter;
    if (
      typeof parsed?.generatedAt !== "string" ||
      typeof parsed?.fingerprint !== "string" ||
      !Array.isArray(parsed?.paragraphs) ||
      typeof parsed?.quiet !== "boolean"
    ) {
      return null;
    }
    return {
      ...parsed,
      paragraphs: parsed.paragraphs.filter(isParagraph),
      experiment:
        parsed.experiment && typeof parsed.experiment.text === "string"
          ? parsed.experiment
          : null,
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      sent: parsed.sent === true,
      experimentDismissed: parsed.experimentDismissed === true,
    };
  } catch {
    return null;
  }
}

export function setCachedLetter(letter: CachedLetter): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(letter));
}

export function clearLetterCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
