/**
 * The Home insight with the user's own AI (product-scope.md B4b).
 *
 * The client sends numbers about each habit and the journal (never journal
 * text); the model writes one sentence and up to three suggestions, each about
 * one habit. Nothing the model says is kept unless the figures back it: every
 * number in a suggestion must be one of that habit's own figures, and every
 * number in the summary one of the figures given. A confident line the data does
 * not support is worse than no line, so it is dropped, and the app falls back to
 * what it can say for certain (design-and-branding.md §4.3, "Never fabricate").
 *
 * A suggestion needs no number: good advice often has none. Its evidence is the
 * habit it names, whose figures the app shows beside it. Pure, with no Deno
 * APIs, so the app's unit tests import it directly.
 */
import { extractJson } from "./model-json.ts";

/** The look-back window the figures cover. */
export const INSIGHT_WINDOW_DAYS = 7;
export const MAX_INSIGHT_ACTIVITIES = 12;
export const MAX_SUGGESTIONS = 3;
export const MAX_SUMMARY_LENGTH = 220;
export const MAX_SUGGESTION_LENGTH = 160;
const MAX_NAME_LENGTH = 60;
const MAX_KEY_LENGTH = 8;

export interface InsightActivity {
  /** Short key chosen by the client; the model echoes it back. */
  key: string;
  name: string;
  /** Completions wanted per day. */
  targetPerDay: number;
  /** Days in the window the target was met. */
  completedDays: number;
  /** Days in the window the habit could have been done. */
  totalDays: number;
  /** The run going into today, in days. */
  streak: number;
}

export interface InsightJournal {
  entriesThisWeek: number;
  streak: number;
  bookmarkedCount: number;
}

export interface InsightRequest {
  range: string;
  activities: InsightActivity[];
  journal: InsightJournal;
  /** Share of due days met across all habits, 0 to 1. */
  completionRate: number;
}

export interface InsightSuggestion {
  /** The `key` of the habit this is about. */
  key: string;
  text: string;
}

export interface InsightResult {
  /** Null when the model gave none, or one that the figures do not back. */
  summary: string | null;
  suggestions: InsightSuggestion[];
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Math.round(value), 100000)
    : null;
}

/**
 * The request body, checked: it is untrusted client input. Null if unusable.
 * A habit sent without a `key` (an app version from before suggestions) is
 * keyed by its position, so the older app keeps working.
 */
export function parseInsightRequest(body: unknown): InsightRequest | null {
  const raw = body as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return null;
  if (raw.range !== `${INSIGHT_WINDOW_DAYS}d`) return null;
  if (!Array.isArray(raw.activities)) return null;
  if (raw.activities.length > MAX_INSIGHT_ACTIVITIES) return null;

  const activities: InsightActivity[] = [];
  const keys = new Set<string>();
  for (const [index, entry] of raw.activities.entries()) {
    const item = entry as Record<string, unknown> | null;
    if (!item || typeof item !== "object") return null;
    const key =
      item.key === undefined ? String(index + 1) : String(item.key).trim();
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const targetPerDay = count(item.targetPerDay);
    const completedDays = count(item.completedDays);
    const totalDays = count(item.totalDays);
    const streak = count(item.streak);
    if (
      !key ||
      key.length > MAX_KEY_LENGTH ||
      keys.has(key) ||
      !name ||
      targetPerDay === null ||
      completedDays === null ||
      totalDays === null ||
      streak === null ||
      completedDays > totalDays
    ) {
      return null;
    }
    keys.add(key);
    activities.push({
      key,
      name: truncate(name, MAX_NAME_LENGTH),
      targetPerDay,
      completedDays,
      totalDays,
      streak,
    });
  }

  const journal = raw.journal as Record<string, unknown> | null;
  const entriesThisWeek = count(journal?.entriesThisWeek);
  const journalStreak = count(journal?.streak);
  const bookmarkedCount = count(journal?.bookmarkedCount);
  const completionRate = raw.completionRate;
  if (
    entriesThisWeek === null ||
    journalStreak === null ||
    bookmarkedCount === null ||
    typeof completionRate !== "number" ||
    !Number.isFinite(completionRate) ||
    completionRate < 0 ||
    completionRate > 1
  ) {
    return null;
  }

  return {
    range: `${INSIGHT_WINDOW_DAYS}d`,
    activities,
    journal: { entriesThisWeek, streak: journalStreak, bookmarkedCount },
    completionRate,
  };
}

export function insightSystemPrompt(): string {
  return (
    "You are a terse habit coach. You get JSON: aggregated statistics for the " +
    `last ${INSIGHT_WINDOW_DAYS} days. "activities" lists habits, each with a ` +
    'short "key", how many days its daily target was met (completedDays) out ' +
    "of the days it could have been done (totalDays), its current streak in " +
    'days, and its targetPerDay; "journal" has counts; "completionRate" is a ' +
    "share from 0 to 1. Never raw journal text. " +
    'Reply with compact JSON only, exactly: {"summary": string, ' +
    '"suggestions": [{"key": string, "text": string}]}. ' +
    `The summary is one sentence under ${MAX_SUMMARY_LENGTH} characters. Give ` +
    `at most ${MAX_SUGGESTIONS} suggestions, each about a different habit, ` +
    'using that habit\'s "key". Each text is one specific, practical step ' +
    `under ${MAX_SUGGESTION_LENGTH} characters. A figure may be cited as ` +
    "digits only if it is given for that same habit (completedDays, " +
    "totalDays, streak, targetPerDay, or the days it was missed); never invent " +
    "or compute any other number. The summary may cite any figure given. " +
    "Base everything only on the figures. No preamble, no markdown."
  );
}

export function insightUserMessage(request: InsightRequest): string {
  return JSON.stringify(request);
}

const NUMBER_PATTERN = /\d+(?:\.\d+)?/g;

function numbersIn(text: string): number[] {
  return (text.match(NUMBER_PATTERN) ?? []).map(Number);
}

/**
 * Every number a line about this habit may mention: its own figures, the window,
 * and any digits in its own name ("Read 20 pages" may say "20 pages").
 */
function allowedForActivity(activity: InsightActivity): Set<number> {
  const missed = Math.max(0, activity.totalDays - activity.completedDays);
  const percent =
    activity.totalDays > 0
      ? Math.round((activity.completedDays / activity.totalDays) * 100)
      : 0;
  return new Set([
    INSIGHT_WINDOW_DAYS,
    activity.targetPerDay,
    activity.completedDays,
    activity.totalDays,
    activity.streak,
    missed,
    percent,
    ...numbersIn(activity.name),
  ]);
}

/** Every number the summary may mention: any figure in the request. */
function allowedForSummary(request: InsightRequest): Set<number> {
  const allowed = new Set<number>([
    INSIGHT_WINDOW_DAYS,
    request.activities.length,
    request.journal.entriesThisWeek,
    request.journal.streak,
    request.journal.bookmarkedCount,
    Math.round(request.completionRate * 100),
  ]);
  for (const activity of request.activities) {
    for (const value of allowedForActivity(activity)) allowed.add(value);
  }
  return allowed;
}

/**
 * A line the figures back: non-empty, and every number in it is allowed. A line
 * with no numbers passes; a line with one the data does not support does not.
 */
function groundedLine(
  raw: unknown,
  allowed: Set<number>,
  max: number,
): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (!numbersIn(text).every((value) => allowed.has(value))) return null;
  return truncate(text, max);
}

/** A suggestion about one habit, kept only if its numbers are that habit's own. */
export function groundedSuggestion(
  raw: unknown,
  activity: InsightActivity,
): string | null {
  return groundedLine(
    raw,
    allowedForActivity(activity),
    MAX_SUGGESTION_LENGTH,
  );
}

/** The summary, kept only if its numbers are figures from the request. */
export function groundedSummary(
  raw: unknown,
  request: InsightRequest,
): string | null {
  return groundedLine(raw, allowedForSummary(request), MAX_SUMMARY_LENGTH);
}

/**
 * The model's answer, reduced to what the figures back. Suggestions about a key
 * that was never sent, a second suggestion about the same habit, and anything
 * past the limit are dropped. Null when the answer is not the shape asked for at
 * all, which is an error; an answer with nothing left after grounding is valid
 * and simply says less.
 */
export function parseInsight(
  raw: string,
  request: InsightRequest,
): InsightResult | null {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const answer = parsed as { summary?: unknown; suggestions?: unknown };
  if (typeof answer.summary !== "string" && !Array.isArray(answer.suggestions)) {
    return null;
  }

  const byKey = new Map(request.activities.map((a) => [a.key, a]));
  const seen = new Set<string>();
  const suggestions: InsightSuggestion[] = [];
  const entries = Array.isArray(answer.suggestions) ? answer.suggestions : [];
  for (const entry of entries) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    const row = entry as { key?: unknown; text?: unknown } | null;
    const key = typeof row?.key === "string" ? row.key.trim() : "";
    const activity = byKey.get(key);
    if (!activity || seen.has(key)) continue;
    const text = groundedSuggestion(row?.text, activity);
    if (!text) continue;
    seen.add(key);
    suggestions.push({ key, text });
  }

  return { summary: groundedSummary(answer.summary, request), suggestions };
}
