import { useAsyncData } from "@/hooks/use-async-data";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  CrowdResultsError,
  fetchCrowdResult,
  type CrowdFailure,
} from "@/lib/questions/results";
import type { CrowdResult } from "@/lib/questions/crowd";

export type CrowdState =
  | { status: "idle" }
  | CrowdResult
  | { status: CrowdFailure };

/**
 * How everyone answered `questionId`, fetched once the person has answered.
 * `choiceId` and `inCrowd` are only keys: changing either reloads, since both
 * move the counts.
 */
export function useCrowdResult(
  questionId: string,
  answered: { id: string; choiceId: string; inCrowd: boolean } | null
) {
  const online = useOnlineStatus();
  const result = useAsyncData<CrowdState>(async () => {
    if (!answered) return { status: "idle" };
    try {
      return await fetchCrowdResult(questionId, answered.id);
    } catch (err) {
      if (err instanceof CrowdResultsError) return { status: err.reason };
      return { status: "failed" };
    }
  }, [questionId, answered?.choiceId, answered?.inCrowd, online]);
  return {
    state: result.data ?? ({ status: "idle" } as CrowdState),
    loading: result.loading && answered !== null,
    retry: result.reload,
  };
}
