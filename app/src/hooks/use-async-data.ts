import {
  useCallback,
  useEffect,
  useReducer,
  useState,
  type DependencyList,
} from "react";
import { getErrorMessage } from "@/lib/error-utils";

interface AsyncDataState<T> {
  data: T | null;
  error: string | null;
  /** Request key of the latest settled load; null until the first load settles. */
  settledKey: readonly unknown[] | null;
}

type AsyncDataAction<T> =
  | { type: "success"; key: readonly unknown[]; data: T }
  | { type: "failure"; key: readonly unknown[]; error: string };

function asyncDataReducer<T>(
  _state: AsyncDataState<T>,
  action: AsyncDataAction<T>
): AsyncDataState<T> {
  switch (action.type) {
    case "success":
      return { data: action.data, error: null, settledKey: action.key };
    case "failure":
      return { data: null, error: action.error, settledKey: action.key };
  }
}

function isSameKey(a: readonly unknown[] | null, b: readonly unknown[]) {
  return (
    a != null && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  );
}

export interface AsyncDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Runs `loader` whenever `deps` change (or `reload` is called) and exposes the
 * outcome. State transitions only happen inside async callbacks and stale loads
 * are cancelled on cleanup, so nothing sets state synchronously in the effect
 * body. `loading` is derived by comparing the settled request key against the
 * current one, which keeps it true while a new load is in flight.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: DependencyList
): AsyncDataResult<T> {
  const [reloadCount, setReloadCount] = useState(0);
  const [state, dispatch] = useReducer(asyncDataReducer<T>, {
    data: null,
    error: null,
    settledKey: null,
  });

  const requestKey: readonly unknown[] = [...deps, reloadCount];

  useEffect(() => {
    let cancelled = false;
    const key: readonly unknown[] = [...deps, reloadCount];
    Promise.resolve()
      .then(loader)
      .then((data) => {
        if (!cancelled) dispatch({ type: "success", key, data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("useAsyncData load failed:", err);
        dispatch({ type: "failure", key, error: getErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-owned loader; deps + reloadCount drive reloading
  }, [...deps, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return {
    data: state.data,
    loading: !isSameKey(state.settledKey, requestKey),
    error: state.error,
    reload,
  };
}
