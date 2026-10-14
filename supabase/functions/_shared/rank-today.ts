/**
 * Ordering Today's open activities with the user's own AI (product-scope.md B2b).
 *
 * The client sends numbers about each open activity (never journal text); the
 * model orders them and writes one short reason per row. A reason is only kept
 * when every number in it is one of the activity's own figures, so the line a
 * person reads on a row is always backed by the data they can check
 * (design-and-branding.md §4.3, "Never fabricate"). Pure, with no Deno APIs, so
 * the app's unit tests import it directly.
 */
import { extractJson } from "./model-json.ts";

export const MAX_RANK_ITEMS = 12;
export const MAX_REASON_LENGTH = 90;
const MAX_NAME_LENGTH = 60;
const MAX_KEY_LENGTH = 8;
/** The look-back window the figures cover; the model may say "last 7 days". */
export const WINDOW_DAYS = 7;

export interface RankItem {
  /** Short key chosen by the client; the model echoes it back. */
  key: string;
  name: string;
  /** "habit" has a check or a count; "time-only" is only timed. */
  type: "habit" | "time-only";
  /** Completions wanted per day. */
  target: number;
  /** Completions logged so far today. */
  doneToday: number;
  /** Days in the window the target was met. */
  daysDone: number;
  /** Days in the window the activity could have been done. */
  daysActive: number;
  /** Current streak, in days. */
  streak: number;
  /** Minutes tracked in the window (timed activities). */
  minutes: number;
}

export interface RankRequest {
  items: RankItem[];
}

export interface RankedItem {
  key: string;
  /** Null when the model gave none, or one that its figures do not back. */
  reason: string | null;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Math.round(value), 100000)
    : null;
}

/** The request body, checked: it is untrusted client input. Null if unusable. */
export function parseRankRequest(body: unknown): RankRequest | null {
  const rawItems = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null;
  if (rawItems.length > MAX_RANK_ITEMS) return null;
  const items: RankItem[] = [];
  const keys = new Set<string>();
  for (const raw of rawItems) {
    const item = raw as Record<string, unknown> | null;
    if (!item || typeof item !== "object") return null;
    const key = typeof item.key === "string" ? item.key.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const target = count(item.target);
    const doneToday = count(item.doneToday);
    const daysDone = count(item.daysDone);
    const daysActive = count(item.daysActive);
    const streak = count(item.streak);
    const minutes = count(item.minutes);
    if (
      !key ||
      key.length > MAX_KEY_LENGTH ||
      keys.has(key) ||
      !name ||
      target === null ||
      doneToday === null ||
      daysDone === null ||
      daysActive === null ||
      streak === null ||
      minutes === null ||
      (item.type !== "habit" && item.type !== "time-only")
    ) {
      return null;
    }
    keys.add(key);
    items.push({
      key,
      name: truncate(name, MAX_NAME_LENGTH),
      type: item.type,
      target,
      doneToday,
      daysDone,
      daysActive,
      streak,
      minutes,
    });
  }
  return { items };
}

export function rankSystemPrompt(): string {
  return (
    "You order a person's habits for today, most useful to do first. You get " +
    `JSON: a list of items, each with figures for the last ${WINDOW_DAYS} days ` +
    "(daysDone of daysActive, streak in days, minutes tracked) and what is " +
    "done today. Never raw journal text. Put first what is most at risk of " +
    "being missed, such as a streak that would break or a habit that has been " +
    "slipping; put steady habits later. " +
    'Reply with compact JSON only, exactly: {"order": [{"key": string, ' +
    '"reason": string}]}. Include every key exactly once. Each reason is one ' +
    `short line, under ${MAX_REASON_LENGTH} characters, that cites at least ` +
    "one figure from that item as digits, for example " +
    '"Done 5 of the last 7 days". Use only figures given for that same ' +
    "item; never invent or compute new numbers. No markdown, no preamble."
  );
}

export function rankUserMessage(request: RankRequest): string {
  return JSON.stringify(request);
}

/** Every number an item's reason may mention: its own figures and the window. */
function allowedNumbers(item: RankItem): Set<number> {
  const hours = item.minutes / 60;
  const numbers = [
    WINDOW_DAYS,
    item.target,
    item.doneToday,
    item.daysDone,
    item.daysActive,
    item.streak,
    item.minutes,
    Math.max(0, item.daysActive - item.daysDone),
    Math.max(0, item.target - item.doneToday),
    Math.round(hours),
    Math.round(hours * 10) / 10,
  ];
  return new Set(numbers);
}

/**
 * A reason that names evidence: it has at least one number, and every number it
 * has is one of the item's own figures. Anything else is dropped, because a
 * confident line the data does not support is worse than no line.
 */
export function groundedReason(raw: unknown, item: RankItem): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const matches = text.match(/\d+(?:\.\d+)?/g);
  if (!matches) return null;
  const allowed = allowedNumbers(item);
  if (!matches.every((value) => allowed.has(Number(value)))) return null;
  return truncate(text, MAX_REASON_LENGTH);
}

/**
 * The model's answer as an order over the request's keys. Keys the model made
 * up or repeated are dropped; keys it left out follow in the order they were
 * sent, so every item always appears once. Null when there is no usable order.
 */
export function parseRanking(
  raw: string,
  request: RankRequest,
): RankedItem[] | null {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return null;
  }
  const order = (parsed as { order?: unknown } | null)?.order;
  if (!Array.isArray(order)) return null;

  const byKey = new Map(request.items.map((item) => [item.key, item]));
  const seen = new Set<string>();
  const ranked: RankedItem[] = [];
  for (const entry of order) {
    const row = entry as { key?: unknown; reason?: unknown } | null;
    const key = typeof row?.key === "string" ? row.key.trim() : "";
    const item = byKey.get(key);
    if (!item || seen.has(key)) continue;
    seen.add(key);
    ranked.push({ key, reason: groundedReason(row?.reason, item) });
  }
  if (ranked.length === 0) return null;
  for (const item of request.items) {
    if (!seen.has(item.key)) ranked.push({ key: item.key, reason: null });
  }
  return ranked;
}
