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
 */
export function orderActivitiesForToday<T extends Orderable>(
  activities: readonly T[],
  counts: Readonly<Record<string, number>>
): T[] {
  const isDone = (activity: T) =>
    activity.routine !== "never" &&
    (counts[activity.id] ?? 0) >= (activity.completion_target ?? 1);

  const bands: T[][] = [[], [], [], []];
  for (const activity of sortActivitiesByOrder(
    activities as Activity[]
  ) as T[]) {
    const band = (activity.is_pinned ? 0 : 2) + (isDone(activity) ? 1 : 0);
    bands[band].push(activity);
  }
  return bands.flat();
}
