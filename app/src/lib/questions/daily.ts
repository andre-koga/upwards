import { TRAITS } from "@/lib/personality/items";
import {
  QUESTIONS,
  QUESTIONS_PER_TRAIT,
  questionsForTrait,
  type Question,
} from "./bank";

const MS_PER_DAY = 86_400_000;
const CYCLE_LENGTH = QUESTIONS.length;

/** Whole days since 1970-01-01 for a local calendar date (YYYY-MM-DD). */
export function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, (month || 1) - 1, day || 1) / MS_PER_DAY);
}

/**
 * The question for a local date. It depends on the date alone, so everyone sees
 * the same question on the same day.
 *
 * The bank is walked in cycles of its own length. Within a cycle the trait
 * changes every day, and every question is asked exactly once. The trait
 * order shifts by one each cycle, so two days in a row never share a trait,
 * not even across the boundary between cycles.
 */
export function questionForDate(date: string): Question {
  const day = dayNumber(date);
  const cycle = Math.floor(day / CYCLE_LENGTH);
  const slot = ((day % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;

  const trait = TRAITS[(slot + cycle) % TRAITS.length];
  const occurrence = Math.floor(slot / TRAITS.length);
  const pool = questionsForTrait(trait);
  return pool[(occurrence + cycle) % QUESTIONS_PER_TRAIT];
}
