import { useAsyncData } from "@/hooks/use-async-data";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  CrowdResultsError,
  fetchCrowdResult,
  type CrowdFailure,
} from "@/lib/questions/results";
import type { CrowdResult } from "@/lib/questions/crowd";
import type { QuestionAnswer } from "@/lib/db/types";

export type CrowdState =
  | { status: "idle" }
  | CrowdResult
  | { status: CrowdFailure };

/**
 * How everyone answered, fetched once the person has answered. A changed choice
 * or crowd switch reloads, since both move the counts.
 */
export function useCrowdResult(
  questionId: string,
  answered: QuestionAnswer | null
) {
  const online = useOnlineStatus();
  const result = useAsyncData<CrowdState>(async () => {
    if (!answered) return { status: "idle" };
    try {
      return await fetchCrowdResult(answered);
    } catch (err) {
      if (err instanceof CrowdResultsError) return { status: err.reason };
      return { status: "failed" };
    }
  }, [questionId, answered?.choice_id, answered?.in_crowd, online]);
  return {
    state: result.data ?? ({ status: "idle" } as CrowdState),
    loading: result.loading && answered !== null,
    retry: result.reload,
  };
}
