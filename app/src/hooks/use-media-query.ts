import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches, kept in sync as it changes.
 * For behavior that differs by width (a click that selects instead of
 * navigates); layout itself stays in CSS.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
