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

/**
 * The order of "For today" when the AI is not configured, or has not run:
 * pinned first, then not yet done, then the stored `order_index`
 * (product-scope.md §1, Task Order). Within a pin/done band the stored order
 * is kept, so the result is stable and a tap never reshuffles unrelated rows.
 *
 * Avoid habits are never "done": a slip is the unwanted outcome, so they sit in
 * the not-done band (and, having no `order_index`, after the scheduled ones).
 *
 * `ranking` is the AI's order (activity ids, best first). It only decides the
 * order inside the pinned-nothing, not-yet-done band: pins still win, done
 * rows still sink, and rows the ranking has not seen (added since, or avoid
 * habits) follow it in stored order.
 */
export function orderActivitiesForToday<T extends Orderable>(
  activities: readonly T[],
  counts: Readonly<Record<string, number>>,
  ranking?: readonly string[]
): T[] {
  const isDone = (activity: T) =>
    activity.routine !== "never" &&
    (counts[activity.id] ?? 0) >= (activity.completion_target ?? 1);

  const bands: T[][] = [[], [], [], []];
  for (const activity of sortActivitiesByOrder(activities)) {
    const band = (activity.is_pinned ? 0 : 2) + (isDone(activity) ? 1 : 0);
    bands[band].push(activity);
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
