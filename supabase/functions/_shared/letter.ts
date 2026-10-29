/**
 * The weekly letter (product-scope.md §2.12).
 *
 * The client sends the week's own words plus the habit figures Home already
 * computes. Nothing the model says is kept unless a quotation is really in
 * the cited day and every number outside that quotation was in the request.
 * A sentence with no quotation is dropped, so "7/7" on its own cannot appear.
 * Pure, with no Deno APIs, so the app's unit tests import it directly.
 */
import { extractJson } from "./model-json.ts";

export const LETTER_WINDOW_DAYS = 7;
export const MAX_LETTER_DAYS = 7;
export const MAX_LETTER_HABITS = 12;
export const MAX_PARAGRAPHS = 2;
export const MAX_PARAGRAPH_LENGTH = 500;
export const MAX_EXPERIMENT_LENGTH = 220;
const MIN_QUOTE_LENGTH = 8;
const MAX_TEXT = 400;
const MAX_TITLE = 80;
const MAX_MEMORY = 500;
const MAX_PLACE = 80;
const MAX_NOTE = 200;
const MAX_MEMORIES = 3;
const MAX_PLACES = 5;
const MAX_NOTES = 8;
const MAX_NAME = 60;

export interface LetterHabit {
  key: string;
  name: string;
  daysDone: number;
  daysActive: number;
  streak: number;
  target: number;
  minutes: number;
}

export interface LetterDay {
  date: string;
  title: string;
  text: string;
  memories: string[];
  places: string[];
  notes: string[];
}

export interface LetterRequest {
  range: "7d";
  weekStart: string;
  language: "en" | "pt";
  days: LetterDay[];
  habits: LetterHabit[];
}

export interface LetterCitation {
  date: string;
  quote: string;
}

export interface LetterParagraph {
  text: string;
  quotes: LetterCitation[];
  /** Habit keys the sentence was allowed to cite. Ids never leave the device. */
  habits: string[];
}

export interface LetterExperiment {
  text: string;
  habitKey: string | null;
  quotes: LetterCitation[];
}

export interface LetterResult {
  paragraphs: LetterParagraph[];
  experiment: LetterExperiment | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_PATTERN = /\d+(?:\.\d+)?/g;

/** Longer words first so "seven" is not matched as a shorter piece. */
const NUMBER_WORDS: ReadonlyArray<readonly [string, number]> = [
  ["twelve", 12],
  ["eleven", 11],
  ["ten", 10],
  ["nine", 9],
  ["eight", 8],
  ["seven", 7],
  ["six", 6],
  ["five", 5],
  ["four", 4],
  ["three", 3],
  ["two", 2],
  ["one", 1],
  ["doze", 12],
  ["onze", 11],
  ["dez", 10],
  ["nove", 9],
  ["oito", 8],
  ["sete", 7],
  ["seis", 6],
  ["cinco", 5],
  ["quatro", 4],
  ["três", 3],
  ["tres", 3],
  ["duas", 2],
  ["dois", 2],
];

export function normalizeWs(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, max: number): string {
  const text = normalizeWs(value);
  return text.length > max ? text.slice(0, max) : text;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Math.round(value), 100000)
    : null;
}

function strings(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (out.length >= maxItems) break;
    if (typeof entry !== "string") continue;
    const text = clip(entry, maxLen);
    if (text) out.push(text);
  }
  return out;
}

function numbersIn(text: string): number[] {
  return (text.match(NUMBER_PATTERN) ?? []).map(Number);
}

/** True when the week has words worth sending. Place names alone do not count. */
export function letterHasProse(request: LetterRequest): boolean {
  return request.days.some(
    (day) =>
      day.title.trim() !== "" ||
      day.text.trim() !== "" ||
      day.memories.some((memory) => memory.trim() !== "") ||
      day.notes.some((note) => note.trim() !== ""),
  );
}

/**
 * The request the model is allowed to see. Null when the body is not a letter
 * request. Unknown fields (coordinates, photos, anything else) are dropped.
 */
export function parseLetterRequest(body: unknown): LetterRequest | null {
  const raw = body as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.range !== "7d") return null;
  if (raw.language !== "en" && raw.language !== "pt") return null;
  if (typeof raw.weekStart !== "string" || !DATE_PATTERN.test(raw.weekStart)) {
    return null;
  }
  if (!Array.isArray(raw.days) || raw.days.length > MAX_LETTER_DAYS) return null;
  if (!Array.isArray(raw.habits) || raw.habits.length > MAX_LETTER_HABITS) {
    return null;
  }

  const days: LetterDay[] = [];
  const seenDates = new Set<string>();
  for (const entry of raw.days) {
    const day = entry as Record<string, unknown> | null;
    if (!day || typeof day !== "object") return null;
    const date = typeof day.date === "string" ? day.date : "";
    if (!DATE_PATTERN.test(date) || seenDates.has(date)) return null;
    seenDates.add(date);
    days.push({
      date,
      title: typeof day.title === "string" ? clip(day.title, MAX_TITLE) : "",
      text: typeof day.text === "string" ? clip(day.text, MAX_TEXT) : "",
      memories: strings(day.memories, MAX_MEMORIES, MAX_MEMORY),
      places: strings(day.places, MAX_PLACES, MAX_PLACE),
      notes: strings(day.notes, MAX_NOTES, MAX_NOTE),
    });
  }

  const habits: LetterHabit[] = [];
  const seenKeys = new Set<string>();
  for (const entry of raw.habits) {
    const habit = entry as Record<string, unknown> | null;
    if (!habit || typeof habit !== "object") return null;
    const key = typeof habit.key === "string" ? habit.key.trim() : "";
    const name = typeof habit.name === "string" ? clip(habit.name, MAX_NAME) : "";
    const daysDone = count(habit.daysDone);
    const daysActive = count(habit.daysActive);
    const streak = count(habit.streak);
    const target = count(habit.target);
    const minutes = count(habit.minutes);
    if (
      !key ||
      key.length > 8 ||
      seenKeys.has(key) ||
      !name ||
      daysDone === null ||
      daysActive === null ||
      streak === null ||
      target === null ||
      minutes === null ||
      daysDone > daysActive
    ) {
      return null;
    }
    seenKeys.add(key);
    habits.push({ key, name, daysDone, daysActive, streak, target, minutes });
  }

  return {
    range: "7d",
    weekStart: raw.weekStart,
    language: raw.language,
    days,
    habits,
  };
}

export function fingerprintLetter(request: LetterRequest): string {
  return JSON.stringify(request);
}

function dayCorpus(day: LetterDay): string[] {
  return [day.title, day.text, ...day.memories, ...day.notes];
}

function quoteInDay(day: LetterDay, quote: string): boolean {
  const needle = normalizeWs(quote);
  if (needle.length < MIN_QUOTE_LENGTH) return false;
  return dayCorpus(day).some((part) => normalizeWs(part).includes(needle));
}

function readCitations(
  value: unknown,
  days: Map<string, LetterDay>,
): LetterCitation[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const quotes: LetterCitation[] = [];
  for (const entry of value) {
    const row = entry as { date?: unknown; quote?: unknown } | null;
    const date = typeof row?.date === "string" ? row.date : "";
    const quote = typeof row?.quote === "string" ? normalizeWs(row.quote) : "";
    const day = days.get(date);
    if (!day || !quoteInDay(day, quote)) return null;
    quotes.push({ date, quote });
  }
  return quotes;
}

function citedHabits(
  value: unknown,
  byKey: Map<string, LetterHabit>,
): LetterHabit[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const habits: LetterHabit[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const habit = byKey.get(entry.trim());
    if (!habit) return null;
    habits.push(habit);
  }
  return habits;
}

function allowedNumbers(
  quotes: readonly LetterCitation[],
  habits: readonly LetterHabit[],
): Set<number> {
  const allowed = new Set<number>();
  const dates = new Set<string>();
  for (const quote of quotes) {
    dates.add(quote.date);
    for (const value of numbersIn(quote.quote)) allowed.add(value);
  }
  allowed.add(quotes.length);
  allowed.add(dates.size);
  for (const date of dates) {
    const [year, month, day] = date.split("-").map(Number);
    allowed.add(year);
    allowed.add(month);
    allowed.add(day);
  }
  for (const habit of habits) {
    allowed.add(habit.daysDone);
    allowed.add(habit.daysActive);
    allowed.add(Math.max(0, habit.daysActive - habit.daysDone));
    allowed.add(habit.streak);
    allowed.add(habit.target);
    allowed.add(habit.minutes);
    for (const value of numbersIn(habit.name)) allowed.add(value);
  }
  return allowed;
}

function outsideQuotes(text: string, quotes: readonly LetterCitation[]): string {
  let rest = normalizeWs(text);
  for (const quote of quotes) {
    rest = rest.split(quote.quote).join(" ");
  }
  return normalizeWs(rest);
}

function numbersAreAllowed(text: string, allowed: Set<number>): boolean {
  if (!numbersIn(text).every((value) => allowed.has(value))) return false;
  const lower = text.toLowerCase();
  for (const [word, value] of NUMBER_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    if (pattern.test(lower) && !allowed.has(value)) return false;
  }
  return true;
}

function quoteShown(text: string, quotes: readonly LetterCitation[]): boolean {
  const normalized = normalizeWs(text);
  return quotes.every((quote) => normalized.includes(quote.quote));
}

function groundParagraph(
  entry: unknown,
  days: Map<string, LetterDay>,
  byKey: Map<string, LetterHabit>,
): LetterParagraph | null {
  const row = entry as {
    text?: unknown;
    quotes?: unknown;
    habits?: unknown;
  } | null;
  if (!row || typeof row.text !== "string") return null;
  const text = clip(row.text, MAX_PARAGRAPH_LENGTH);
  if (!text) return null;
  const quotes = readCitations(row.quotes, days);
  if (!quotes || !quoteShown(text, quotes)) return null;
  const habits = citedHabits(row.habits, byKey);
  if (!habits) return null;
  const outside = outsideQuotes(text, quotes);
  if (!numbersAreAllowed(outside, allowedNumbers(quotes, habits))) return null;
  return {
    text,
    quotes,
    habits: habits.map((habit) => habit.key),
  };
}

function groundExperiment(
  entry: unknown,
  days: Map<string, LetterDay>,
  byKey: Map<string, LetterHabit>,
): LetterExperiment | null {
  // An array is several experiments. Only the first one that grounds is kept.
  const candidates = Array.isArray(entry) ? entry : [entry];
  for (const candidate of candidates) {
    const row = candidate as {
      text?: unknown;
      quotes?: unknown;
      habitKey?: unknown;
      habits?: unknown;
      newHabit?: unknown;
    } | null;
    if (!row || typeof row !== "object") continue;
    if (typeof row.newHabit === "string" && row.newHabit.trim()) continue;
    if (typeof row.text !== "string") continue;
    const text = clip(row.text, MAX_EXPERIMENT_LENGTH);
    if (!text) continue;
    const quotes = readCitations(row.quotes, days);
    if (!quotes || !quoteShown(text, quotes)) continue;
    let habitKey: string | null = null;
    if (row.habitKey !== undefined && row.habitKey !== null) {
      if (typeof row.habitKey !== "string") continue;
      const key = row.habitKey.trim();
      if (!key || !byKey.has(key)) continue;
      habitKey = key;
    }
    const habits = citedHabits(row.habits, byKey);
    if (!habits) continue;
    const cited = habits.slice();
    if (habitKey) {
      const named = byKey.get(habitKey);
      if (named && !cited.some((habit) => habit.key === habitKey)) {
        cited.push(named);
      }
    }
    const outside = outsideQuotes(text, quotes);
    if (!numbersAreAllowed(outside, allowedNumbers(quotes, cited))) continue;
    return { text, habitKey, quotes };
  }
  return null;
}

/**
 * The model's answer, reduced to what the week supports. Null when the answer
 * is not the shape asked for. An answer with nothing left after the checks is
 * valid and simply says less.
 */
export function parseLetter(raw: string, request: LetterRequest): LetterResult | null {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const answer = parsed as {
    paragraphs?: unknown;
    experiment?: unknown;
    experiments?: unknown;
  };
  if (
    answer.paragraphs === undefined &&
    answer.experiment === undefined &&
    answer.experiments === undefined
  ) {
    return null;
  }

  const days = new Map(request.days.map((day) => [day.date, day]));
  const byKey = new Map(request.habits.map((habit) => [habit.key, habit]));
  const paragraphs: LetterParagraph[] = [];
  const entries = Array.isArray(answer.paragraphs) ? answer.paragraphs : [];
  for (const entry of entries) {
    if (paragraphs.length >= MAX_PARAGRAPHS) break;
    const paragraph = groundParagraph(entry, days, byKey);
    if (paragraph) paragraphs.push(paragraph);
  }

  // `experiments` is a second list. It is ignored when `experiment` is present,
  // and when it is the only one, only its first grounded item is kept.
  const experimentSource =
    answer.experiment !== undefined ? answer.experiment : answer.experiments;
  const experiment =
    experimentSource === undefined
      ? null
      : groundExperiment(experimentSource, days, byKey);

  return { paragraphs, experiment };
}

export function letterSystemPrompt(language: LetterRequest["language"]): string {
  const languageName = language === "pt" ? "Portuguese (Brazil)" : "English";
  return (
    "You read someone's week back to them. You are a thoughtful friend who " +
    "keeps records, not a coach. Plain, warm, second person. No diagnosis, " +
    'no "you always", no scolding a missed day, no exclamation marks. ' +
    `Write every sentence of yours in ${languageName}. Quotations stay in ` +
    "the language of the day, copied exactly. " +
    "You get JSON for the last 7 days: each day may have a title, text, " +
    "memories, place names, and session notes. habits lists practices they " +
    "already track, with daysDone, daysActive, streak, target, and minutes. " +
    "Reply with compact JSON only, exactly: " +
    '{"paragraphs":[{"text":string,"quotes":[{"date":string,"quote":string}],' +
    '"habits":[string]}],"experiment":{"text":string,"habitKey":string|null,' +
    '"quotes":[{"date":string,"quote":string}],"habits":[string]}|null}. ' +
    `At most ${MAX_PARAGRAPHS} paragraphs, each under ${MAX_PARAGRAPH_LENGTH} ` +
    "characters, and at most one experiment, under " +
    `${MAX_EXPERIMENT_LENGTH} characters. Every paragraph and the experiment ` +
    "must include at least one quote that is a contiguous substring of that " +
    "date's title, text, memories, or notes, and the quote must appear inside " +
    "your text. A sentence with no quote will be discarded. Cite a number " +
    "only when it is that quote, that date, or a figure of a habit key you " +
    "listed. Do not invent a habit, a task, or a person. Do not open with a " +
    "completion rate. If the writing is thin, say you do not know yet, and " +
    "still quote what was written. The experiment watches one thing they " +
    "already do or a gap in the writing. habitKey is one of the given keys, " +
    "or null. No preamble, no markdown."
  );
}

export function letterUserMessage(request: LetterRequest): string {
  return JSON.stringify(request);
}
