import { useCallback, useEffect, useRef } from "react";
import { getEffectiveToday } from "@/lib/session/day-reset";
import {
  computeAndSaveLoginStreak,
  loadLastOpenedDate,
  saveLastOpenedDate,
} from "@/lib/session/last-opened";

/**
 * On app open / visibility, update login streak and last-opened date.
 * Keeps stats check-in streak accurate without any recap UI.
 */
export function useAppOpenSession(): void {
  const checkedRef = useRef(false);

  const check = useCallback(() => {
    const today = getEffectiveToday();
    const lastDate = loadLastOpenedDate();
    computeAndSaveLoginStreak(lastDate, today);
    saveLastOpenedDate(today);
  }, []);

  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true;
      check();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [check]);
}
