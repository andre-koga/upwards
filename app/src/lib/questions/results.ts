import { parseCrowdResult, type CrowdResult } from "./crowd";
import { getOrCreateGuestId } from "./guest-id";
import type { QuestionAnswer } from "@/lib/db/types";
import { getQueueAccountId, supabase } from "@/lib/supabase";
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
 * A guest has no account to sync an answer to, so the answer goes with the
 * question: the server records it under the guest's random id and returns the
 * counts in one call. Asking again with the same answer changes nothing.
 */
async function fetchGuestResult(answer: QuestionAnswer): Promise<CrowdResult> {
  if (!supabase) throw new CrowdResultsError("offline");
  const { data, error } = await supabase.rpc("guest_question_results", {
    p_guest_id: getOrCreateGuestId(),
    p_question_id: answer.question_id,
    p_choice_id: answer.choice_id,
    p_answered_on: answer.answered_on,
  });
  if (error) throw new CrowdResultsError("failed");
  const parsed = parseCrowdResult(data);
  if (!parsed) throw new CrowdResultsError("failed");
  return parsed;
}

/**
 * Asks the server how everyone answered. The counts have to include the answer
 * as it is now. An account's answer is pushed first if it has not gone yet; a
 * guest's answer travels with the request.
 */
export async function fetchCrowdResult(
  answer: QuestionAnswer
): Promise<CrowdResult> {
  if (!supabase || !navigator.onLine) throw new CrowdResultsError("offline");

  if (!getQueueAccountId()) return fetchGuestResult(answer);

  if (await hasPendingOperationForEntity(answer.id)) {
    try {
      await syncEngine.sync();
    } catch {
      throw new CrowdResultsError("pending");
    }
  }

  let { data, error } = await callResults(answer.question_id);
  if (error?.code === NOT_ANSWERED_YET) {
    try {
      await syncEngine.sync();
    } catch {
      throw new CrowdResultsError("pending");
    }
    ({ data, error } = await callResults(answer.question_id));
    if (error?.code === NOT_ANSWERED_YET) {
      throw new CrowdResultsError("pending");
    }
  }
  if (error) throw new CrowdResultsError("failed");

  const parsed = parseCrowdResult(data);
  if (!parsed) throw new CrowdResultsError("failed");
  return parsed;
}
