import { parseCrowdResult, type CrowdResult } from "./crowd";
import { supabase } from "@/lib/supabase";
import { syncEngine } from "@/lib/sync";
import { hasPendingOperationForEntity } from "@/lib/sync/unsynced-data";

export type CrowdFailure = "offline" | "pending" | "failed";

/** Why the crowd view is not there: no connection, not synced yet, or an error. */
export class CrowdResultsError extends Error {
  readonly reason: CrowdFailure;

  constructor(reason: CrowdFailure) {
    super(reason);
    this.name = "CrowdResultsError";
    this.reason = reason;
  }
}

const NOT_ANSWERED_YET = "42501";

async function callResults(questionId: string) {
  if (!supabase) throw new CrowdResultsError("offline");
  return supabase.rpc("question_results", { p_question_id: questionId });
}

/**
 * Asks the server how everyone answered. The counts have to include the answer
 * as it is now, and the server only answers someone who has answered, so an
 * answer that has not gone yet is pushed first.
 */
export async function fetchCrowdResult(
  questionId: string,
  answerId: string
): Promise<CrowdResult> {
  if (!supabase || !navigator.onLine) throw new CrowdResultsError("offline");

  if (await hasPendingOperationForEntity(answerId)) {
    try {
      await syncEngine.sync();
    } catch {
      throw new CrowdResultsError("pending");
    }
  }

  let { data, error } = await callResults(questionId);
  if (error?.code === NOT_ANSWERED_YET) {
    try {
      await syncEngine.sync();
    } catch {
      throw new CrowdResultsError("pending");
    }
    ({ data, error } = await callResults(questionId));
    if (error?.code === NOT_ANSWERED_YET) {
      throw new CrowdResultsError("pending");
    }
  }
  if (error) throw new CrowdResultsError("failed");

  const parsed = parseCrowdResult(data);
  if (!parsed) throw new CrowdResultsError("failed");
  return parsed;
}
