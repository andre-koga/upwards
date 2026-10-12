import { supabase } from "@/lib/supabase";
import { describeInsightError, readInsightErrorBody } from "./insight-errors";
import type { RankedActivity } from "./today-ranking";
import type { RankRequest } from "../../../../supabase/functions/_shared/rank-today";

export class RankTodayError extends Error {
  readonly code: string | null;
  constructor(message: string, code: string | null) {
    super(message);
    this.name = "RankTodayError";
    this.code = code;
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Asks the `rank-today` function for an order. The reply is keyed by the short
 * keys in `request`; they are mapped back to activity ids here. `t` must resolve
 * the `error.*` keys of `describeInsightError`.
 */
export async function requestTodayRanking(
  request: RankRequest,
  idByKey: ReadonlyMap<string, string>,
  t: Translate
): Promise<RankedActivity[]> {
  if (!supabase) throw new RankTodayError(t("error.offline"), "offline");
  const { data, error } = await supabase.functions.invoke("rank-today", {
    body: request,
  });
  if (error) {
    const body = await readInsightErrorBody(error);
    throw new RankTodayError(
      describeInsightError(body, error.message, t),
      body?.code ?? null
    );
  }
  const order: unknown = data?.order;
  if (!Array.isArray(order)) {
    throw new RankTodayError(
      describeInsightError({ code: "provider_invalid" }, "", t),
      "provider_invalid"
    );
  }
  const ranked: RankedActivity[] = [];
  for (const row of order as { key?: unknown; reason?: unknown }[]) {
    const id = typeof row?.key === "string" ? idByKey.get(row.key) : undefined;
    if (!id) continue;
    ranked.push({
      id,
      reason: typeof row.reason === "string" ? row.reason : null,
    });
  }
  return ranked;
}
