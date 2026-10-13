import type { Activity } from "@/lib/db/types";
import { sortActivitiesByOrder } from "./utils";

type Orderable = Pick<
  Activity,
  | "id"
  | "routine"
  | "completion_target"
  | "is_pinned"
  | "order_index"
  | "created_at"
>;

export interface TodayOrderOptions {
  /**
   * Done habits sink below the open ones (the default). When false they stay
   * where the stored order puts them, so ticking a row never moves it.
   */
  doneLast?: boolean;
}

function isDone(
  activity: Orderable,
  counts: Readonly<Record<string, number>>
): boolean {
  return (
    activity.routine !== "never" &&
    (counts[activity.id] ?? 0) >= (activity.completion_target ?? 1)
  );
}

/**
 * The band a row sits in. Rows only ever move within a band: pins above the
 * rest and, unless done habits stay in place, done rows below open ones.
 */
function todayOrderBand(
  activity: Orderable,
  counts: Readonly<Record<string, number>>,
  { doneLast = true }: TodayOrderOptions = {}
): number {
  const done = doneLast && isDone(activity, counts);
  return (activity.is_pinned ? 0 : 2) + (done ? 1 : 0);
}

/**
 * The order of "For today": pinned first, then not yet done, then the stored
 * `order_index`, which the person edits with the reorder controls
 * (product-scope.md §1, Task Order). Within a pin/done band the stored order
 * is kept, so the result is stable and a tap never reshuffles unrelated rows.
 *
 * Avoid habits are never "done": a slip is the unwanted outcome, so they sit in
 * the not-done band (and, having no `order_index`, after the scheduled ones).
 *
 * `ranking` is the AI's order (activity ids, best first). It is a temporary
 * view on top of the person's order: it only decides the order inside the
 * unpinned, not-yet-done band. Pins still win, done rows still sink (unless
 * kept in place), and rows the ranking has not seen (added since, or avoid
 * habits) follow it in stored order. Dropping the ranking restores the
 * person's order untouched.
 */
export function orderActivitiesForToday<T extends Orderable>(
  activities: readonly T[],
  counts: Readonly<Record<string, number>>,
  ranking?: readonly string[],
  options: TodayOrderOptions = {}
): T[] {
  const bands: T[][] = [[], [], [], []];
  for (const activity of sortActivitiesByOrder(activities)) {
    bands[todayOrderBand(activity, counts, options)].push(activity);
  }
  if (ranking?.length) {
    const position = new Map(ranking.map((id, index) => [id, index]));
    // Array.prototype.sort is stable: unranked rows keep their stored order.
    bands[2].sort(
      (left, right) =>
        (position.get(left.id) ?? ranking.length) -
        (position.get(right.id) ?? ranking.length)
    );
  }
  return bands.flat();
}

export interface OrderIndexPatch {
  id: string;
  order_index: number;
}

/** Whether `id` has a neighbour in `direction` inside its own band. */
export function canMoveActivity<T extends Orderable>(
  ordered: readonly T[],
  id: string,
  direction: -1 | 1,
  counts: Readonly<Record<string, number>>,
  options: TodayOrderOptions = {}
): boolean {
  return findNeighbour(ordered, id, direction, counts, options) !== null;
}

function findNeighbour<T extends Orderable>(
  ordered: readonly T[],
  id: string,
  direction: -1 | 1,
  counts: Readonly<Record<string, number>>,
  options: TodayOrderOptions
): T | null {
  const index = ordered.findIndex((activity) => activity.id === id);
  if (index < 0) return null;
  const band = todayOrderBand(ordered[index], counts, options);
  const neighbour = ordered[index + direction];
  if (!neighbour) return null;
  return todayOrderBand(neighbour, counts, options) === band ? neighbour : null;
}

/**
 * The `order_index` writes that move one row a step up (-1) or down (+1)
 * among the rows shown, staying inside its pin/done band.
 *
 * `ordered` is today's list in the person's own order (no AI ranking);
 * `all` is every active activity, so a renumber stays consistent with rows not
 * scheduled today. Two distinct numbers are simply swapped. Ties and rows
 * without an index (avoid habits, offline duplicates) renumber the whole
 * sequence densely, writing only the rows whose number changes.
 */
export function planActivityMove<T extends Orderable>(
  all: readonly T[],
  ordered: readonly T[],
  id: string,
  direction: -1 | 1,
  counts: Readonly<Record<string, number>>,
  options: TodayOrderOptions = {}
): OrderIndexPatch[] {
  const moved = ordered.find((activity) => activity.id === id);
  const neighbour = findNeighbour(ordered, id, direction, counts, options);
  if (!moved || !neighbour) return [];

  const a = moved.order_index;
  const b = neighbour.order_index;
  if (typeof a === "number" && typeof b === "number" && a !== b) {
    return [
      { id: moved.id, order_index: b },
      { id: neighbour.id, order_index: a },
    ];
  }

  const sequence = sortActivitiesByOrder(all);
  const from = sequence.findIndex((activity) => activity.id === moved.id);
  const to = sequence.findIndex((activity) => activity.id === neighbour.id);
  if (from < 0 || to < 0) return [];
  [sequence[from], sequence[to]] = [sequence[to], sequence[from]];

  const patches: OrderIndexPatch[] = [];
  sequence.forEach((activity, index) => {
    if (activity.order_index !== index) {
      patches.push({ id: activity.id, order_index: index });
    }
  });
  return patches;
}
